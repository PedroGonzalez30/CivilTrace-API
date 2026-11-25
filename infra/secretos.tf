# Key Vault para CLAVE_CIFRADO_PORTAL (constitución IV.1). El VALOR del secreto no va en Terraform
# (quedaría en el estado): se carga con az CLI, ver infra/README.md.

resource "azurerm_key_vault" "secretos" {
  name                       = "${var.prefijo}-kv-${substr(md5(data.azurerm_resource_group.principal.id), 0, 6)}"
  location                   = data.azurerm_resource_group.principal.location
  resource_group_name        = data.azurerm_resource_group.principal.name
  tenant_id                  = data.azurerm_client_config.actual.tenant_id
  sku_name                   = "standard"
  rbac_authorization_enabled = true
  purge_protection_enabled   = false
  soft_delete_retention_days = 7
}

# La API solo puede leer secretos de este Key Vault.
resource "azurerm_role_assignment" "api_lee_secretos" {
  scope                = azurerm_key_vault.secretos.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = data.azurerm_linux_web_app.api.identity[0].principal_id
}

# Quien aplica Terraform puede escribir el secreto con az CLI.
resource "azurerm_role_assignment" "operador_escribe_secretos" {
  scope                = azurerm_key_vault.secretos.id
  role_definition_name = "Key Vault Secrets Officer"
  principal_id         = data.azurerm_client_config.actual.object_id
}
