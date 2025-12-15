# --- CONFIGURACIÓN ---
$pm2Path = "C:\pm2-offline\node_modules\.bin\pm2.cmd"
$nssmPath = "C:\pm2-offline\nssm.exe"
$appPath = "C:\Program Files\requerimientos_fiscales\src\index.js"
$appName = "rrff-app"
$serviceName = "pm2-rrff"
$logDir = "C:\pm2-offline\logs"

# --- VALIDACIÓN DE ARCHIVOS ---
if (-not (Test-Path $pm2Path)) { Write-Error "No se encontró pm2 en: $pm2Path"; exit 1 }
if (-not (Test-Path $nssmPath)) { Write-Error "No se encontró NSSM en: $nssmPath"; exit 1 }
if (-not (Test-Path $appPath)) { Write-Error "No se encontró el archivo de aplicación en: $appPath"; exit 1 }

# --- PASO 1: Iniciar la app con PM2 ---
& "$pm2Path" start "$appPath" --name "$appName"

# --- PASO 2: Guardar el estado actual ---
& "$pm2Path" save --force

# --- PASO 3: Eliminar servicio anterior si existe ---
if (Get-Service -Name $serviceName -ErrorAction SilentlyContinue) {
    Stop-Service $serviceName -Force -ErrorAction SilentlyContinue
    sc.exe delete $serviceName | Out-Null
    Start-Sleep -Seconds 2
}

# --- PASO 4: Crear servicio NSSM para levantar PM2 resurrect ---
$fullCmd = "cmd.exe"
$fullArgs = "/c `"$pm2Path` resurrect"

Start-Process -FilePath $nssmPath -ArgumentList @("install", $serviceName, $fullCmd, $fullArgs) -Wait

# --- PASO 5: Crear directorio de logs si no existe ---
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

# --- PASO 6: Redirigir logs ---
Start-Process -FilePath $nssmPath -ArgumentList @("set", $serviceName, "AppStdout", "$logDir\stdout.log") -Wait
Start-Process -FilePath $nssmPath -ArgumentList @("set", $serviceName, "AppStderr", "$logDir\stderr.log") -Wait

# --- PASO 7: Iniciar el servicio ---
try {
    Start-Service "$serviceName"
    Write-Host ""
    Write-Host "App registrada como servicio '$serviceName'."
    Write-Host "PM2 restaurará '$appName' automáticamente al reiniciar Windows."
    Write-Host "Verifica con: Get-Service | Where-Object { `$_.Name -like 'pm2*' }"
} catch {
    Write-Error "No se pudo iniciar el servicio. Revisa los logs:"
    Write-Host "$logDir\stderr.log"
}
