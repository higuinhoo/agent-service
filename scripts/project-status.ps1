$ErrorActionPreference = 'Stop'

function Get-Section {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$HeadingPattern
    )

    $lines = Get-Content -LiteralPath $Path
    $start = -1
    for ($index = 0; $index -lt $lines.Count; $index++) {
        if ($lines[$index] -match $HeadingPattern) {
            $start = $index
            break
        }
    }

    if ($start -lt 0) { return @() }

    $result = [System.Collections.Generic.List[string]]::new()
    for ($index = $start; $index -lt $lines.Count; $index++) {
        if ($index -gt $start -and $lines[$index] -match '^## ') { break }
        $result.Add($lines[$index])
    }
    return $result
}

$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root

Write-Output '# Contexto compacto do projeto'
Write-Output "branch: $(git branch --show-current 2>$null)"

$changes = @(git status --short 2>$null)
if ($changes.Count -eq 0) {
    Write-Output 'git: limpo'
} else {
    Write-Output "git: $($changes.Count) caminho(s) alterado(s)"
    $changes | Select-Object -First 12
    if ($changes.Count -gt 12) { Write-Output '... saída limitada; use git status --short para detalhes' }
}

Write-Output ''
Get-Section -Path 'docs/STATUS.md' -HeadingPattern '^## Fase$'
Write-Output ''
Get-Section -Path 'docs/TASKS.md' -HeadingPattern '^## ATIVA'
Write-Output ''
Get-Section -Path 'docs/HANDOFF.md' -HeadingPattern '^## Próximo passo único$'
