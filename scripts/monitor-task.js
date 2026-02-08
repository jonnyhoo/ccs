#!/usr/bin/env node

/**
 * CCS Background Task Monitor
 *
 * 监控 CCS 后台任务的执行状态，提供可靠的状态检测
 *
 * 使用方法:
 *   node monitor-task.js <taskId>
 *   node monitor-task.js <outputFile>
 *
 * 功能:
 * 1. 检测任务是否启动（输出文件是否存在）
 * 2. 检测任务是否完成（stream-json 中是否有 stop_reason）
 * 3. 检测任务是否卡住（文件大小长时间不变）
 * 4. 检测 API 端点是否可用（解析错误信息）
 * 5. 实时显示任务进度
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// 配置
const CHECK_INTERVAL = 2000; // 检查间隔 2 秒
const STUCK_TIMEOUT = 30000; // 30 秒文件大小不变视为卡住
const MAX_WAIT_TIME = 300000; // 最多等待 5 分钟

class TaskMonitor {
  constructor(taskIdOrFile) {
    this.taskIdOrFile = taskIdOrFile;
    this.outputFile = this._resolveOutputFile(taskIdOrFile);
    this.lastSize = 0;
    this.lastChangeTime = Date.now();
    this.startTime = Date.now();
    this.checkCount = 0;
  }

  _resolveOutputFile(input) {
    // 如果是完整路径，直接使用
    if (fs.existsSync(input)) {
      return input;
    }

    // 如果是 taskId，构建路径
    const taskDir = path.join(os.tmpdir(), 'ccs-tasks');
    const outputFile = path.join(taskDir, `${input}.output`);

    if (fs.existsSync(outputFile)) {
      return outputFile;
    }

    // 尝试查找匹配的文件
    if (fs.existsSync(taskDir)) {
      const files = fs.readdirSync(taskDir);
      const matched = files.find(f => f.includes(input) && f.endsWith('.output'));
      if (matched) {
        return path.join(taskDir, matched);
      }
    }

    return outputFile; // 返回预期路径，即使不存在
  }

  async monitor() {
    console.log(`[Monitor] 开始监控任务: ${path.basename(this.outputFile)}`);
    console.log(`[Monitor] 输出文件: ${this.outputFile}`);
    console.log('');

    while (true) {
      this.checkCount++;
      const elapsed = Date.now() - this.startTime;

      // 超时检查
      if (elapsed > MAX_WAIT_TIME) {
        console.log(`\n[超时] 任务执行超过 ${MAX_WAIT_TIME / 1000} 秒，停止监控`);
        return { status: 'timeout', elapsed };
      }

      // 文件存在性检查
      if (!fs.existsSync(this.outputFile)) {
        console.log(`[等待] 输出文件尚未生成... (${(elapsed / 1000).toFixed(1)}s)`);
        await this._sleep(CHECK_INTERVAL);
        continue;
      }

      // 读取文件内容
      const stats = fs.statSync(this.outputFile);
      const currentSize = stats.size;

      // 文件大小变化检查
      if (currentSize !== this.lastSize) {
        this.lastSize = currentSize;
        this.lastChangeTime = Date.now();
      } else {
        const stuckTime = Date.now() - this.lastChangeTime;
        if (stuckTime > STUCK_TIMEOUT && currentSize > 0) {
          // 文件有内容但长时间不变，可能已完成或卡住
          const result = this._analyzeOutput();
          if (result.completed) {
            console.log(`\n[完成] 任务执行完成 (${(elapsed / 1000).toFixed(1)}s)`);
            return result;
          } else {
            console.log(`\n[警告] 文件大小 ${stuckTime / 1000}s 未变化，可能卡住`);
          }
        }
      }

      // 分析输出内容
      const result = this._analyzeOutput();

      // 显示进度
      this._displayProgress(result, elapsed);

      // 检查是否完成
      if (result.completed) {
        console.log(`\n[完成] 任务执行完成 (${(elapsed / 1000).toFixed(1)}s)`);
        return result;
      }

      // 检查是否有错误
      if (result.error) {
        console.log(`\n[错误] 任务执行失败: ${result.error}`);
        return result;
      }

      await this._sleep(CHECK_INTERVAL);
    }
  }

  _analyzeOutput() {
    try {
      const content = fs.readFileSync(this.outputFile, 'utf8');
      const lines = content.trim().split('\n');

      const result = {
        completed: false,
        error: null,
        sessionId: null,
        totalCost: null,
        turns: 0,
        toolUses: [],
        lastMessage: null,
        apiAvailable: true,
      };

      // 解析每一行 stream-json
      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const msg = JSON.parse(line);

          // 提取 session_id
          if (msg.session_id) {
            result.sessionId = msg.session_id;
          }

          // 检测初始化消息（说明 API 可用）
          if (msg.type === 'system' && msg.subtype === 'init') {
            result.apiAvailable = true;
          }

          // 检测助手消息
          if (msg.type === 'assistant' && msg.message) {
            result.lastMessage = msg.message;

            // 检测完成标志
            if (msg.message.stop_reason) {
              result.completed = true;
            }

            // 提取工具使用
            if (msg.message.content) {
              const tools = msg.message.content.filter(c => c.type === 'tool_use');
              result.toolUses.push(...tools.map(t => t.name));
            }
          }

          // 检测用户消息（计算轮次）
          if (msg.type === 'user') {
            result.turns++;
          }

          // 检测成本信息
          if (msg.type === 'system' && msg.subtype === 'cost') {
            result.totalCost = msg.total_cost_usd;
          }

          // 检测错误
          if (msg.type === 'error' || (msg.message && msg.message.error)) {
            result.error = msg.error || msg.message.error;
            result.apiAvailable = false;
          }

        } catch (parseError) {
          // 忽略解析错误，可能是不完整的行
        }
      }

      // 检测 API 连接错误（通过内容关键词）
      if (content.includes('ECONNREFUSED') || content.includes('ETIMEDOUT')) {
        result.error = 'API 端点连接失败';
        result.apiAvailable = false;
      }

      if (content.includes('401') || content.includes('Unauthorized')) {
        result.error = 'API 认证失败';
        result.apiAvailable = false;
      }

      if (content.includes('429') || content.includes('rate limit')) {
        result.error = 'API 速率限制';
        result.apiAvailable = false;
      }

      return result;

    } catch (error) {
      return {
        completed: false,
        error: `读取输出文件失败: ${error.message}`,
        apiAvailable: false,
      };
    }
  }

  _displayProgress(result, elapsed) {
    const elapsedSec = (elapsed / 1000).toFixed(1);
    const size = (this.lastSize / 1024).toFixed(1);

    let status = `[进行中] ${elapsedSec}s | ${size}KB`;

    if (result.sessionId) {
      status += ` | Session: ${result.sessionId.substring(0, 8)}`;
    }

    if (result.turns > 0) {
      status += ` | 轮次: ${result.turns}`;
    }

    if (result.toolUses.length > 0) {
      const lastTool = result.toolUses[result.toolUses.length - 1];
      status += ` | 最后工具: ${lastTool}`;
    }

    if (result.totalCost) {
      status += ` | 成本: $${result.totalCost.toFixed(4)}`;
    }

    // 使用 \r 覆盖同一行
    process.stdout.write(`\r${status}`.padEnd(100));
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('用法: node monitor-task.js <taskId|outputFile>');
    console.error('');
    console.error('示例:');
    console.error('  node monitor-task.js ccs-1770543682008-m9ml7u');
    console.error('  node monitor-task.js /tmp/ccs-tasks/ccs-1770543682008-m9ml7u.output');
    process.exit(1);
  }

  const taskIdOrFile = args[0];
  const monitor = new TaskMonitor(taskIdOrFile);

  try {
    const result = await monitor.monitor();

    console.log('\n');
    console.log('=== 任务结果 ===');
    console.log(`状态: ${result.completed ? '✓ 完成' : result.error ? '✗ 失败' : '? 未知'}`);

    if (result.error) {
      console.log(`错误: ${result.error}`);
    }

    if (result.sessionId) {
      console.log(`Session ID: ${result.sessionId}`);
    }

    if (result.turns > 0) {
      console.log(`执行轮次: ${result.turns}`);
    }

    if (result.totalCost) {
      console.log(`总成本: $${result.totalCost.toFixed(4)}`);
    }

    if (result.toolUses.length > 0) {
      console.log(`使用的工具: ${[...new Set(result.toolUses)].join(', ')}`);
    }

    console.log(`API 可用性: ${result.apiAvailable ? '✓ 可用' : '✗ 不可用'}`);

    process.exit(result.completed ? 0 : 1);

  } catch (error) {
    console.error(`\n[错误] 监控失败: ${error.message}`);
    process.exit(1);
  }
}

main();
