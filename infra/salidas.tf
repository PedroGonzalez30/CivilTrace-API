output "endpoint_comunicacion" {
  description = "Valor para AZURE_COMUNICACION_ENDPOINT en el App Service."
  value       = "https://${azurerm_communication_service.comunicacion.hostname}"
}

output "remitente_correo" {
  description = "Valor para CORREO_REMITENTE en el App Service."
  value       = "DoNotReply@${azurerm_email_communication_service_domain.dominio_azure.mail_from_sender_domain}"
}

output "url_portal" {
  description = "Valor para URL_PORTAL en el App Service y origen permitido en CORS."
  value       = "https://${azurerm_static_web_app.portal.default_host_name}"
}

output "token_despliegue_portal" {
  description = "Secreto AZURE_STATIC_WEB_APPS_API_TOKEN del repo CivilTrace-Portal."
  value       = azurerm_static_web_app.portal.api_key
  sensitive   = true
}

output "nombre_key_vault" {
  value = azurerm_key_vault.secretos.name
}
