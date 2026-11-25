# Feature 004 (T-04, T056). Proveedores de Terraform para la infraestructura de Civil Trace.
# El estado se guarda localmente por ahora (terraform.tfstate está en .gitignore); cuando se
# importen los recursos existentes (módulo 00) se moverá a un backend remoto.
terraform {
  required_version = ">= 1.9"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }
}

provider "azurerm" {
  features {}
  subscription_id = var.id_suscripcion
}
