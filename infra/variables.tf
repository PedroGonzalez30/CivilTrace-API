# Variables (constitución V.3): región, nombres, niveles y suscripción no van fijos en el código.

variable "id_suscripcion" {
  description = "Suscripción de Azure (Azure for Students hoy; la del cliente al entregar)."
  type        = string
}

variable "entorno" {
  description = "estudiantes (actual) o cliente (México Central, se crea desde cero)."
  type        = string
  default     = "estudiantes"
}

variable "grupo_recursos" {
  description = "Grupo de recursos existente."
  type        = string
  default     = "rg-civiltrace"
}

variable "nombre_api" {
  description = "App Service existente de la API (se lee, no se modifica)."
  type        = string
  default     = "civiltrace-api"
}

variable "region_portal" {
  description = "Static Web Apps Free solo existe en algunas regiones; West US 2 es la más cercana."
  type        = string
  default     = "westus2"
}

variable "ubicacion_datos_correo" {
  description = "Dónde guarda sus datos Azure Communication Services."
  type        = string
  default     = "United States"
}

variable "prefijo" {
  description = "Prefijo de los recursos nuevos."
  type        = string
  default     = "civiltrace"
}
