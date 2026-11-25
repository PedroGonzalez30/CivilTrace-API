# Portal web del cliente (T-02): Azure Static Web Apps nivel Free (constitución V.5).

resource "azurerm_static_web_app" "portal" {
  name                = "${var.prefijo}-portal"
  resource_group_name = data.azurerm_resource_group.principal.name
  location            = var.region_portal
  sku_tier            = "Free"
  sku_size            = "Free"
}
