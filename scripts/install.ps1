$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$base = 'https://updates.feedbacksele.com.br'

Write-Host 'Verificando a versao mais recente do Kiro Code...'
$response = Invoke-WebRequest -Uri "$base/latest.yml" -UseBasicParsing
if ($response.Content -is [byte[]]) {
    $yaml = [System.Text.Encoding]::UTF8.GetString($response.Content)
} else {
    $yaml = $response.Content
}

if ($yaml -notmatch 'path:\s*(.+)') {
    throw 'Nao foi possivel identificar o instalador mais recente.'
}
$fileName = $matches[1].Trim()
$installerUrl = "$base/$([uri]::EscapeDataString($fileName))"
$out = Join-Path $env:TEMP $fileName

Write-Host "Baixando $fileName..."
Invoke-WebRequest -Uri $installerUrl -OutFile $out -UseBasicParsing

Write-Host 'Instalando...'
Start-Process -FilePath $out -Wait

Write-Host 'Pronto! O Kiro Code foi instalado.'
Write-Host 'Lembrete: o kiro-cli precisa estar instalado e acessivel no PATH para o app funcionar.'
