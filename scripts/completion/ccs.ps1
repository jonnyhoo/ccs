# PowerShell completion for CCS (Claude Code Switch)
# Compatible with PowerShell 5.1+
#
# Installation:
#   Add to your PowerShell profile ($PROFILE):
#     . /path/to/ccs/scripts/completion/ccs.ps1
#
#   Or install for current user:
#     Copy-Item scripts/completion/ccs.ps1 ~\Documents\PowerShell\Scripts\
#     Add to profile: . ~\Documents\PowerShell\Scripts\ccs.ps1

Register-ArgumentCompleter -CommandName ccs -ScriptBlock {
    param($commandName, $wordToComplete, $commandAst, $fakeBoundParameters)

    $commands = @('auth', 'api', 'cliproxy', 'doctor', 'sync', 'update', '--help', '--version', '--shell-completion', '-h', '-v', '-sc')
    $cliproxyProfiles = @('gemini', 'codex', 'agy', 'qwen')
    $authCommands = @('create', 'list', 'show', 'remove', 'default', '--help', '-h')
    $apiCommands = @('create', 'list', 'remove', '--help', '-h')
    $cliproxyCommands = @('create', 'list', 'remove', '--install', '--latest', '--help', '-h')
    $apiCreateFlags = @('--base-url', '--api-key', '--model', '--force', '--yes', '-y')
    $cliproxyCreateFlags = @('--provider', '--model', '--force', '--yes', '-y')
    $providerFlags = @('--auth', '--config', '--logout', '--headless', '--help', '-h')
    $updateFlags = @('--force', '--beta', '--dev', '--help', '-h')
    $shellCompletionFlags = @('--bash', '--zsh', '--fish', '--powershell')
    $listFlags = @('--verbose', '--json')
    $removeFlags = @('--yes', '-y')
    $showFlags = @('--json')
    $providers = @('gemini', 'codex', 'agy', 'qwen')

    # Get current position in command
    $words = $commandAst.ToString() -split '\s+' | Where-Object { $_ -ne '' }
    $position = $words.Count

    # Helper function to get profiles
    function Get-CcsProfiles {
        param([string]$Type = 'all')

        $profiles = @()

        # Settings-based profiles
        if ($Type -in @('all', 'settings')) {
            $configPath = "$env:USERPROFILE\.ccs\config.json"
            if (Test-Path $configPath) {
                try {
                    $config = Get-Content $configPath -Raw | ConvertFrom-Json
                    $profiles += $config.profiles.PSObject.Properties.Name
                } catch {}
            }
        }

        # Account-based profiles
        if ($Type -in @('all', 'account')) {
            $profilesPath = "$env:USERPROFILE\.ccs\profiles.json"
            if (Test-Path $profilesPath) {
                try {
                    $data = Get-Content $profilesPath -Raw | ConvertFrom-Json
                    $profiles += $data.profiles.PSObject.Properties.Name
                } catch {}
            }
        }

        # CLIProxy variants
        if ($Type -in @('all', 'cliproxy')) {
            $configPath = "$env:USERPROFILE\.ccs\config.json"
            if (Test-Path $configPath) {
                try {
                    $config = Get-Content $configPath -Raw | ConvertFrom-Json
                    if ($config.cliproxy) {
                        $profiles += $config.cliproxy.PSObject.Properties.Name
                    }
                } catch {}
            }
        }

        return $profiles | Sort-Object -Unique
    }

    # Top-level completion
    if ($position -eq 2) {
        $allOptions = $commands + $cliproxyProfiles + (Get-CcsProfiles)
        $allOptions | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
            [System.Management.Automation.CompletionResult]::new(
                $_,
                $_,
                'ParameterValue',
                $_
            )
        }
        return
    }

    # shell-completion flag completion
    if ($words[1] -eq '--shell-completion' -or $words[1] -eq '-sc') {
        if ($position -eq 3) {
            $shellCompletionFlags | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                [System.Management.Automation.CompletionResult]::new(
                    $_,
                    $_,
                    'ParameterValue',
                    $_
                )
            }
        }
        return
    }

    # CLIProxy provider flags (gemini, codex, agy, qwen)
    if ($words[1] -in $cliproxyProfiles) {
        $providerFlags | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
            [System.Management.Automation.CompletionResult]::new(
                $_,
                $_,
                'ParameterValue',
                $_
            )
        }
        return
    }

    # update command completion
    if ($words[1] -eq 'update') {
        $updateFlags | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
            [System.Management.Automation.CompletionResult]::new(
                $_,
                $_,
                'ParameterValue',
                $_
            )
        }
        return
    }

    # auth subcommand completion
    if ($words[1] -eq 'auth') {
        if ($position -eq 3) {
            $authCommands | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                [System.Management.Automation.CompletionResult]::new(
                    $_,
                    $_,
                    'ParameterValue',
                    $_
                )
            }
        } elseif ($position -eq 4) {
            switch ($words[2]) {
                'show' {
                    $options = (Get-CcsProfiles -Type account) + $showFlags
                    $options | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                        [System.Management.Automation.CompletionResult]::new(
                            $_,
                            $_,
                            'ParameterValue',
                            $_
                        )
                    }
                }
                'remove' {
                    $options = (Get-CcsProfiles -Type account) + $removeFlags
                    $options | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                        [System.Management.Automation.CompletionResult]::new(
                            $_,
                            $_,
                            'ParameterValue',
                            $_
                        )
                    }
                }
                'default' {
                    Get-CcsProfiles -Type account | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                        [System.Management.Automation.CompletionResult]::new(
                            $_,
                            $_,
                            'ParameterValue',
                            $_
                        )
                    }
                }
                'list' {
                    $listFlags | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                        [System.Management.Automation.CompletionResult]::new(
                            $_,
                            $_,
                            'ParameterValue',
                            $_
                        )
                    }
                }
                'create' {
                    @('--force') | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                        [System.Management.Automation.CompletionResult]::new(
                            $_,
                            $_,
                            'ParameterValue',
                            $_
                        )
                    }
                }
            }
        } elseif ($position -eq 5) {
            switch ($words[2]) {
                'show' {
                    $showFlags | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                        [System.Management.Automation.CompletionResult]::new(
                            $_,
                            $_,
                            'ParameterValue',
                            $_
                        )
                    }
                }
                'remove' {
                    $removeFlags | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                        [System.Management.Automation.CompletionResult]::new(
                            $_,
                            $_,
                            'ParameterValue',
                            $_
                        )
                    }
                }
            }
        }
        return
    }

    # api subcommand completion
    if ($words[1] -eq 'api') {
        if ($position -eq 3) {
            $apiCommands | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                [System.Management.Automation.CompletionResult]::new(
                    $_,
                    $_,
                    'ParameterValue',
                    $_
                )
            }
        } elseif ($position -eq 4) {
            switch ($words[2]) {
                'remove' {
                    $options = (Get-CcsProfiles -Type settings) + $removeFlags
                    $options | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                        [System.Management.Automation.CompletionResult]::new(
                            $_,
                            $_,
                            'ParameterValue',
                            $_
                        )
                    }
                }
                'create' {
                    $apiCreateFlags | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                        [System.Management.Automation.CompletionResult]::new(
                            $_,
                            $_,
                            'ParameterValue',
                            $_
                        )
                    }
                }
            }
        } elseif ($position -eq 5) {
            switch ($words[2]) {
                'remove' {
                    $removeFlags | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                        [System.Management.Automation.CompletionResult]::new(
                            $_,
                            $_,
                            'ParameterValue',
                            $_
                        )
                    }
                }
            }
        }
        return
    }

    # cliproxy subcommand completion
    if ($words[1] -eq 'cliproxy') {
        if ($position -eq 3) {
            $cliproxyCommands | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                [System.Management.Automation.CompletionResult]::new(
                    $_,
                    $_,
                    'ParameterValue',
                    $_
                )
            }
        } elseif ($position -eq 4) {
            switch ($words[2]) {
                'remove' {
                    $options = (Get-CcsProfiles -Type cliproxy) + $removeFlags
                    $options | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                        [System.Management.Automation.CompletionResult]::new(
                            $_,
                            $_,
                            'ParameterValue',
                            $_
                        )
                    }
                }
                'create' {
                    $cliproxyCreateFlags | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                        [System.Management.Automation.CompletionResult]::new(
                            $_,
                            $_,
                            'ParameterValue',
                            $_
                        )
                    }
                }
            }
        } elseif ($position -eq 5) {
            switch ($words[2]) {
                'remove' {
                    $removeFlags | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                        [System.Management.Automation.CompletionResult]::new(
                            $_,
                            $_,
                            'ParameterValue',
                            $_
                        )
                    }
                }
                'create' {
                    # After --provider, complete with provider names
                    if ($words[3] -eq '--provider') {
                        $providers | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                            [System.Management.Automation.CompletionResult]::new(
                                $_,
                                $_,
                                'ParameterValue',
                                $_
                            )
                        }
                    }
                }
            }
        }
        return
    }

    # profile subcommand completion (legacy)
    if ($words[1] -eq 'profile') {
        if ($position -eq 3) {
            @('create', 'list', 'remove', '--help', '-h') | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                [System.Management.Automation.CompletionResult]::new(
                    $_,
                    $_,
                    'ParameterValue',
                    $_
                )
            }
        } elseif ($position -eq 4) {
            switch ($words[2]) {
                'remove' {
                    $options = (Get-CcsProfiles -Type settings) + $removeFlags
                    $options | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                        [System.Management.Automation.CompletionResult]::new(
                            $_,
                            $_,
                            'ParameterValue',
                            $_
                        )
                    }
                }
                'create' {
                    $apiCreateFlags | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                        [System.Management.Automation.CompletionResult]::new(
                            $_,
                            $_,
                            'ParameterValue',
                            $_
                        )
                    }
                }
            }
        } elseif ($position -eq 5) {
            switch ($words[2]) {
                'remove' {
                    $removeFlags | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                        [System.Management.Automation.CompletionResult]::new(
                            $_,
                            $_,
                            'ParameterValue',
                            $_
                        )
                    }
                }
            }
        }
        return
    }
}
