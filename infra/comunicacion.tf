# Correo del portal del cliente (T-03, research R-02): Azure Communication Services con un
# dominio administrado por Azure. La API envía con su identidad administrada (sin llaves).

resource "azurerm_email_communication_service" "correo" {
  name                = "${var.prefijo}-correo"
  resource_group_name = data.azurerm_resource_group.principal.name
  data_location       = var.ubicacion_datos_correo
}

resource "azurerm_email_communication_service_domain" "dominio_azure" {
  name              = "AzureManagedDomain"
  email_service_id  = azurerm_email_communication_service.correo.id
  domain_management = "AzureManaged"
}

resource "azurerm_communication_service" "comunicacion" {
  name                = "${var.prefijo}-comunicacion"
  resource_group_name = data.azurerm_resource_group.principal.name
  data_location       = var.ubicacion_datos_correo
}

resource "azurerm_communication_service_email_domain_association" "asociacion" {
  communication_service_id = azurerm_communication_service.comunicacion.id
  email_service_domain_id  = azurerm_email_communication_service_domain.dominio_azure.id
}

# Permiso mínimo: solo sobre el recurso de comunicación, nunca sobre la suscripción (V.4).
# Confirmar en la documentación de ACS el rol vigente para enviar con Entra ID antes de aplicar.
resource "azurerm_role_assignment" "api_envia_correo" {
  scope                = azurerm_communication_service.comunicacion.id
  role_definition_name = "Contributor"
  principal_id         = data.azurerm_linux_web_app.api.identity[0].principal_id
}
