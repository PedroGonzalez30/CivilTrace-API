# Infraestructura (Terraform) — feature 004

Crea **solo recursos nuevos** para el portal del cliente. Los recursos que ya existen
(`rg-civiltrace`, `civiltrace-api`, base de datos, almacenamiento) se **leen** con bloques `data`,
así que Terraform no los puede borrar ni reemplazar (constitución V.2). Importarlos queda para el
módulo de infraestructura (T-04).

| Recurso nuevo                                  | Para qué                                     | Costo      |
| ---------------------------------------------- | -------------------------------------------- | ---------- |
| Email Communication Service + dominio de Azure | Enlace del portal, avisos y códigos (T-03)   | Por correo |
| Communication Service                          | Envía los correos con la identidad de la API | —          |
| Static Web App (Free)                          | Portal del cliente (T-02)                    | Gratis     |
| Key Vault (standard)                           | `CLAVE_CIFRADO_PORTAL` (constitución IV.1)   | Centavos   |

## 1. Planear (no cambia nada)

```powershell
cd CivilTrace-API\infra
az login
copy terraform.tfvars.example terraform.tfvars   # y poner el id de la suscripción
terraform init
terraform plan -out plan.tfplan
```

Revisar que el plan diga **solo `create`** (unos 10 recursos) y **ningún `destroy` ni
`replace`**. Si aparece alguno, detenerse y preguntar.

## 2. Aplicar (crea los recursos)

```powershell
terraform apply plan.tfplan
terraform output
```

## 3. Guardar la llave del portal en Key Vault

```powershell
$kv = terraform output -raw nombre_key_vault
$llave = node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
az keyvault secret set --vault-name $kv --name clave-cifrado-portal --value $llave
```

La llave **no se cambia después**: si cambia, los enlaces ya enviados a los clientes dejan de
funcionar.

## 4. Variables del App Service `civiltrace-api`

```powershell
$kv = terraform output -raw nombre_key_vault
az webapp config appsettings set -g rg-civiltrace -n civiltrace-api --settings `
  URL_PORTAL="$(terraform output -raw url_portal)" `
  AZURE_COMUNICACION_ENDPOINT="$(terraform output -raw endpoint_comunicacion)" `
  CORREO_REMITENTE="$(terraform output -raw remitente_correo)" `
  CLAVE_CIFRADO_PORTAL="@Microsoft.KeyVault(VaultName=$kv;SecretName=clave-cifrado-portal)"
```

## 5. Repositorio `CivilTrace-Portal`

- Secreto `AZURE_STATIC_WEB_APPS_API_TOKEN` = `terraform output -raw token_despliegue_portal`.
- Variable `VITE_URL_API` = `https://civiltrace-api-bhffckcachbsb5cn.westus-01.azurewebsites.net`.
- Si la dirección de la API cambia, actualizar también `connect-src` en
  `public/staticwebapp.config.json` del portal.

## Pendiente de confirmar

- El rol para que la identidad de la API envíe correo con Entra ID está como `Contributor` sobre el
  recurso de comunicación (no sobre la suscripción). Confirmar el rol mínimo vigente en la
  documentación de Azure Communication Services antes de aplicar.
