<#
  @archivo prepararPruebaLocal.ps1
  @proyecto Civil Trace
  @descripcion Deja listos la API, el portal y la app para probar en la red local, sin Azure: pone
    la IP del Wi-Fi en URL_PORTAL (API), VITE_URL_API (portal) y EXPO_PUBLIC_API_URL (app). Los
    correos salen en la consola de la API (CORREO_EN_CONSOLA=true) y las fotos se guardan en
    almacenamiento-local/ (D-32). Hay que volver a correrlo cada vez que cambie la red.
  @autor Emilio Manuel Esquivel
  @fecha 25/11/2026
  @version 1.0.0
  @historial 25/11/2026 - Emilio Manuel Esquivel - Creación
  Uso (desde C:\proyectos\CivilTrace-API):
    powershell -ExecutionPolicy Bypass -File herramientas\prepararPruebaLocal.ps1 [-Ip 10.0.0.5]
#>
param([string]$Ip)

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$api = Join-Path $raiz 'CivilTrace-API\.env'
$portal = Join-Path $raiz 'CivilTrace-Portal\.env.local'
$app = Join-Path $raiz 'CivilTrace\.env.local'
$utf8 = New-Object System.Text.UTF8Encoding($false)

if (-not $Ip) {
  $Ip = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias 'Wi-Fi*' -ErrorAction SilentlyContinue |
      Where-Object { $_.IPAddress -notlike '169.254*' } | Select-Object -First 1).IPAddress
}
if (-not $Ip) { throw 'No encontré la IP del Wi-Fi. Pásala con -Ip <dirección>.' }
if (-not (Test-Path $api)) { throw "No existe $api. Cópialo de .env.example primero." }

# Cambia (o agrega) una variable sin tocar las demás líneas del archivo.
function Set-Variable-Entorno([string]$archivo, [string]$nombre, [string]$valor) {
  $lineas = if (Test-Path $archivo) { [System.IO.File]::ReadAllLines($archivo) } else { @() }
  $encontrada = $false
  $nuevas = foreach ($linea in $lineas) {
    if ($linea -match "^\s*$nombre=") { $encontrada = $true; "$nombre=$valor" } else { $linea }
  }
  if (-not $encontrada) { $nuevas = @($nuevas) + "$nombre=$valor" }
  [System.IO.File]::WriteAllLines($archivo, [string[]]$nuevas, $utf8)
}

$contenidoApi = [System.IO.File]::ReadAllText($api)
if ($contenidoApi -notmatch '(?m)^CLAVE_CIFRADO_PORTAL=\S{40,}') {
  $bytes = New-Object byte[] 32
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $llave = [Convert]::ToBase64String($bytes)
  Set-Variable-Entorno $api 'CLAVE_CIFRADO_PORTAL' $llave
  Write-Host 'CLAVE_CIFRADO_PORTAL creada (los enlaces que ya se habían mandado dejan de servir).'
}
if ($contenidoApi -match '(?m)^AZURE_STORAGE_CUENTA=\S') {
  Write-Warning 'AZURE_STORAGE_CUENTA está definida: las fotos irían a Azure. Coméntala para usar almacenamiento-local/.'
}
Set-Variable-Entorno $api 'NODE_ENV' 'development'
Set-Variable-Entorno $api 'CORREO_EN_CONSOLA' 'true'
# El CORS de la API solo acepta este origen: abre el portal con esta misma dirección.
Set-Variable-Entorno $api 'URL_PORTAL' "http://${Ip}:5173"
Set-Variable-Entorno $portal 'VITE_URL_API' "http://${Ip}:3000"
Set-Variable-Entorno $app 'EXPO_PUBLIC_API_URL' "http://${Ip}:3000"

Write-Host ''
Write-Host "Listo con la IP $Ip. En tres terminales:"
Write-Host '  1. API:    cd CivilTrace-API;    docker compose up -d; npx prisma migrate deploy --config prisma7.config.ts; npm run dev'
Write-Host '  2. Portal: cd CivilTrace-Portal; npm run dev -- --host'
Write-Host '  3. App:    cd CivilTrace;        npx expo start --clear   (escanea el QR con Expo Go)'
Write-Host "Los correos (enlace del portal y código) salen en la consola de la API; el portal es http://${Ip}:5173"
