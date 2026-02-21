#!/usr/bin/env node

/**
 * Background Task Monitor
 *
 * 监控 CCS 后台任务的执行状态，提供非阻塞的状态检测
 */

import * as fs from 'fs';
import { info, warn, ok, fail } from '../utils/ui';

export interface TaskStatus {
  taskId: string;
  outputFile: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'stuck';
  sessionId?: string;
  turns: number;
  totalCost?: number;
  lastTool?: string;
  error?: string;
  apiAvailable: boolean;
  fileSize: number;
  lastUpdate: number;
  elapsed: number;
}

export interface MonitorOptions {
  checkInterval?: number; // 检查间隔（毫秒）
  stuckTimeout?: number; // 文件大小不变多久视为卡住（毫秒）
  maxWaitTime?: number; // 最大等待时间（毫秒）
  onProgress?: (status: TaskStatus) => void; // 进度回调
  onComplete?: (status: TaskStatus) => void; // 完成回调
  onError?: (status: TaskStatus) => void; // 错误回调
  silent?: boolean; // 静默模式（不输出到控制台）
}

/**
 * Background Task Monitor
 */
export class BackgroundMonitor {
  private taskId: string;
  private outputFile: string;
  private options: Required<MonitorOptions>;
  private lastSize: number = 0;
  private lastChangeTime: number = Date.now();
  private startTime: number = Date.now();
  private intervalHandle?: NodeJS.Timeout;
  private isMonitoring: boolean = false;

  constructor(taskId: string, outputFile: string, options: MonitorOptions = {}) {
    this.taskId = taskId;
    this.outputFile = outputFile;
    this.options = {
      checkInterval: options.checkInterval || 2000,
      stuckTimeout: options.stuckTimeout || 30000,
      maxWaitTime: options.maxWaitTime || 300000,
      onProgress: options.onProgress || (() => {}),
      onComplete: options.onComplete || (() => {}),
      onError: options.onError || (() => {}),
      silent: options.silent || false,
    };
  }

  /**
   * 启动监控（非阻塞）
   */
  start(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.startTime = Date.now();

    if (!this.options.silent) {
      console.error(info(`Background monitor started for task: ${this.taskId}`));
      console.error(info(`Monitor output: tail -f ${this.outputFile}`));
    }

    // 启动定时检查
    this.intervalHandle = setInterval(() => {
      this.check();
    }, this.options.checkInterval);

    // 立即执行一次检查
    this.check();
  }

  /**
   * 停止监控
   */
  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = undefined;
    }
    this.isMonitoring = false;
  }

  /**
   * 执行一次状态检查
   */
  private check(): void {
    const elapsed = Date.now() - this.startTime;

    // 超时检查
    if (elapsed > this.options.maxWaitTime) {
      const status = this.buildStatus('failed', elapsed);
      status.error = `Task timeout after ${this.options.maxWaitTime / 1000}s`;
      this.handleError(status);
      this.stop();
      return;
    }

    // 文件状态检查（合并 existsSync + statSync 避免竞态）
    let currentSize: number;
    try {
      const stats = fs.statSync(this.outputFile);
      currentSize = stats.size;
    } catch {
      const status = this.buildStatus('pending', elapsed);
      this.options.onProgress(status);
      return;
    }

    // 文件大小变化检查
    if (currentSize !== this.lastSize) {
      this.lastSize = currentSize;
      this.lastChangeTime = Date.now();
    }

    // 分析输出内容
    const status = this.analyzeOutput(elapsed);

    // 检测卡住状态
    const stuckTime = Date.now() - this.lastChangeTime;
    if (stuckTime > this.options.stuckTimeout && currentSize > 0) {
      if (!status.error && status.status === 'running') {
        status.status = 'stuck';
        if (!this.options.silent) {
          console.error(
            warn(`Task may be stuck (no output for ${(stuckTime / 1000).toFixed(1)}s)`)
          );
        }
      }
    }

    // 触发回调
    if (status.status === 'completed') {
      this.handleComplete(status);
      this.stop();
    } else if (status.status === 'failed') {
      this.handleError(status);
      this.stop();
    } else {
      this.options.onProgress(status);
    }
  }

  /**
   * 分析输出文件内容
   */
  private analyzeOutput(elapsed: number): TaskStatus {
    try {
      const content = fs.readFileSync(this.outputFile, 'utf8');
      const lines = content.trim().split('\n');

      const status = this.buildStatus('running', elapsed);
      let hasInit = false;

      // 解析每一行 stream-json
      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const msg = JSON.parse(line);

          // 提取 session_id
          if (msg.session_id) {
            status.sessionId = msg.session_id;
          }

          // 检测初始化消息（说明 API 可用）
          if (msg.type === 'system' && msg.subtype === 'init') {
            hasInit = true;
            status.apiAvailable = true;
          }

          // 检测助手消息
          if (msg.type === 'assistant' && msg.message) {
            // 检测完成标志
            if (msg.message.stop_reason) {
              status.status = 'completed';
            }

            // 提取工具使用
            if (msg.message.content) {
              const tools = msg.message.content.filter(
                (c: { type: string }) => c.type === 'tool_use'
              );
              if (tools.length > 0) {
                status.lastTool = tools[tools.length - 1].name;
              }
            }
          }

          // 检测用户消息（计算轮次）
          if (msg.type === 'user') {
            status.turns++;
          }

          // 检测成本信息
          if (msg.type === 'system' && msg.subtype === 'cost') {
            status.totalCost = msg.total_cost_usd;
          }

          // 检测错误
          if (msg.type === 'error' || (msg.message && msg.message.error)) {
            status.status = 'failed';
            status.error = msg.error || msg.message.error;
            status.apiAvailable = false;
          }
        } catch (_parseError) {
          // 忽略解析错误，可能是不完整的行
        }
      }

      // 检测 API 连接错误（通过内容关键词）
      if (content.includes('ECONNREFUSED') || content.includes('ETIMEDOUT')) {
        status.status = 'failed';
        status.error = 'API endpoint connection failed';
        status.apiAvailable = false;
      }

      if (content.includes('401') || content.includes('Unauthorized')) {
        status.status = 'failed';
        status.error = 'API authentication failed';
        status.apiAvailable = false;
      }

      if (content.includes('429') || content.includes('rate limit')) {
        status.status = 'failed';
        status.error = 'API rate limit exceeded';
        status.apiAvailable = false;
      }

      // 如果有内容但没有 init 消息，可能是启动失败
      if (lines.length > 0 && !hasInit && status.fileSize > 100) {
        status.apiAvailable = false;
      }

      return status;
    } catch (error) {
      const status = this.buildStatus('failed', elapsed);
      status.error = `Failed to read output file: ${(error as Error).message}`;
      status.apiAvailable = false;
      return status;
    }
  }

  /**
   * 构建状态对象
   */
  private buildStatus(status: TaskStatus['status'], elapsed: number): TaskStatus {
    return {
      taskId: this.taskId,
      outputFile: this.outputFile,
      status,
      turns: 0,
      apiAvailable: true,
      fileSize: this.lastSize,
      lastUpdate: this.lastChangeTime,
      elapsed,
    };
  }

  /**
   * 处理完成事件
   */
  private handleComplete(status: TaskStatus): void {
    if (!this.options.silent) {
      console.error('');
      console.error(ok(`Task completed: ${this.taskId}`));
      if (status.sessionId) {
        console.error(info(`  Session: ${status.sessionId.substring(0, 8)}`));
      }
      if (status.turns > 0) {
        console.error(info(`  Turns: ${status.turns}`));
      }
      if (status.totalCost) {
        console.error(info(`  Cost: $${status.totalCost.toFixed(4)}`));
      }
      console.error(info(`  Output: ${this.outputFile}`));
    }
    this.options.onComplete(status);
  }

  /**
   * 处理错误事件
   */
  private handleError(status: TaskStatus): void {
    if (!this.options.silent) {
      console.error('');
      console.error(fail(`Task failed: ${this.taskId}`));
      if (status.error) {
        console.error(fail(`  Error: ${status.error}`));
      }
      console.error(info(`  API Available: ${status.apiAvailable ? 'Yes' : 'No'}`));
      console.error(info(`  Output: ${this.outputFile}`));
    }
    this.options.onError(status);
  }

  /**
   * 获取当前状态（同步）
   */
  getStatus(): TaskStatus {
    const elapsed = Date.now() - this.startTime;
    try {
      fs.statSync(this.outputFile);
    } catch {
      return this.buildStatus('pending', elapsed);
    }
    return this.analyzeOutput(elapsed);
  }
}

/**
 * 创建并���动后台监控器
 */
export function startBackgroundMonitor(
  taskId: string,
  outputFile: string,
  options: MonitorOptions = {}
): BackgroundMonitor {
  const monitor = new BackgroundMonitor(taskId, outputFile, options);
  monitor.start();
  return monitor;
}
