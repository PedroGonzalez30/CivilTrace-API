# Recursos que ya existen (T-05). Se LEEN con bloques data: Terraform no los puede borrar ni
# reemplazar (constitución V.2). Importarlos queda para el módulo de infraestructura.

data "azurerm_resource_group" "principal" {
  name = var.grupo_recursos
}

data "azurerm_linux_web_app" "api" {
  name                = var.nombre_api
  resource_group_name = data.azurerm_resource_group.principal.name
}

data "azurerm_client_config" "actual" {}
