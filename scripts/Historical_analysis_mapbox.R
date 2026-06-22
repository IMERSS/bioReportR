# Map history of vascular plant surveys in Átl’ka7tsem

# Set relative paths (https://stackoverflow.com/questions/13672720/r-command-for-setting-working-directory-to-source-file-location-in-rstudio)
if (!isTRUE(getOption('knitr.in.progress'))) {
  setwd(paste0(dirname(rstudioapi::getActiveDocumentContext()$path), "/.."))
}

# Load libraries

library(dplyr)
library(raster)
library(scales)
library(sf)
library(jsonlite)
library(viridis)
library(htmlwidgets)
library(plotly)

# Source dependencies

source("scripts/mapbox_map_common.R")

cumulative.history <- read.csv("tabular_data/history_1897-2024_cumulative.csv")

year <- cumulative.history$year

# Plot analysis of historical collection activities

speciesPlot <- plot_ly()

speciesPlot <- speciesPlot %>%
      layout(
        title = list(
          text = "Vascular plant species recorded in Átl'ḵa7tsem/Howe Sound 1890-2024",
          font = list(size = 14)
        ),
        showlegend = FALSE,
        xaxis = list(title="Year", range = c(1900, 2024)),
        yaxis = list(title='Reported Species', range=c(0, max(cumulative.history$cum.spp)))
      )

steps <- list()

# General method cribbed from https://plotly.com/r/sliders/#sine-wave-slider

for (i in 1:length(year)) {
    args <- list('visible', rep(FALSE, length(year)))
    args[[2]][i] = TRUE
    steps[[i]] <- list(label = year[[i]], method="restyle", args=args)
    sppRange <- cumulative.history$cum.spp[1:i]
    yearRange <- year[1:i]
    speciesPlot <- speciesPlot %>% add_lines(x=yearRange, y=sppRange, line=list(color='green'), type='scatter', mode='lines', visible = i == 1)
}

speciesPlot <- layout(speciesPlot, meta = list(mx_widgetId = "speciesPlot"),
                      sliders = list(list(active=0, steps = steps)))

speciesPlot


# Most historical data collected in the 1920s and between the 1960s and 1980s;
# Large increase in observations and recorded species with the emergence of
# iNaturalist in 2010s; no. species reported for Howe Sound has nearly doubled
# over the last two decades

# Plot gridded choropleth illustrating historical timeline of plant surveys 1897-2022

# Load map layers
# Layer 1: hillshade raster
hillshade.source <- geotiff_to_mapbox_source("spatial_data/rasters/Hillshade_80m.tif", id="Hillshade")
hillshade.feature <- list(type = "raster", source = "Hillshade", rasterOpacity = 0.8, paint = spectral_raster_color_paint(), Z_Order = 0.75)

# Layer 2: coastline
coastline <- mx_read("spatial_data/vectors/Islands_and_Mainland")
coastline.source <- sf_to_mapbox_sources(coastline, id = "Coastline")
coastline.feature <- list(type = "vector", source = "Coastline", outlineColor = "black", outlineWidth = 1.5, fillOpacity = 0)

# Layer 3: choropleth
choropleth.feature <- list(type = "choropleth");

# Layer 4: watershed boundary
watershed.boundary <- mx_read("spatial_data/vectors/Howe_Sound")
watershed.source <- sf_to_mapbox_sources(watershed.boundary, id = "Watershed.Boundary")
watershed.feature <- list(type = "vector", source = "Watershed.Boundary", outlineColor = "black", outlineWidth = 4, fillOpacity = 0)

allSources <- merge_lists(hillshade.source, coastline.source, watershed.source)

view.feature <- list(type = "view", lon = -123.2194, lat = 49.66076, zoom = 8.5)

allFeatures = list(view.feature, hillshade.feature, coastline.feature, choropleth.feature, watershed.feature)

heatMap <- plot_mapbox_map("History", allSources, allFeatures)

# Note that this statement is only effective in standalone R
print(heatMap)
