library(readr)
library(dplyr)
library(data.table)
library(sf)

## Stanza 1: Reduce incoming GBIF data to one row per taxa

read_GBIF = function (filename) {
  sr_time <- Sys.time()
  # Advice from https://discourse.gbif.org/t/problem-parsing-large-occurrence-downloads/2570
  rawGbif <- readr::read_tsv(filename, quote="", col_types = cols(.default = "c"))
  elapsed <- round(as.numeric(difftime(Sys.time(), sr_time, units = "secs")), 2)
  message(sprintf("Read %d lines in %.2f s", nrow(rawGbif), elapsed))
  rawGbif
}

all <- read_GBIF("big_data/gbif-howe-context-tracheophyta-2026-03-27-raw.tsv")
all_sf <- st_as_sf(all, coords = c("decimalLongitude", "decimalLatitude"), crs = 4326)

realContext = read_sf("big_data/GeoRegionV2_Terrestrial_dissolved/");

all_sf_real_context <- st_filter(all_sf, realContext)
all_real_context <- all_sf_real_context %>%
  mutate(
    decimalLongitude = st_coordinates(.)[, 1],
    decimalLatitude = st_coordinates(.)[, 2]
  ) %>%
  st_drop_geometry()

# Rough and ready, just resolve data at species level
all$scientificName <- all$species

all_reduced <- all[!duplicated(all$scientificName), ] %>% filter(!is.na(scientificName))

write.csv(all_reduced, "big_data/gbif-howe-context-tracheophyta-2026-03-27-reduced.csv", row.names = FALSE, na = "", fileEncoding = "UTF-8")

# node ../bagatelle/src/assignBNames.js big_data/gbif-howe-context-tracheophyta-2026-03-27-reduced.csv --DwCA

## Stanza 3: Reconstitute original "assigned" data by joining with assigned reduced data

assigned <- readr::read_csv("big_data/gbif-howe-context-tracheophyta-2026-03-27-assigned.csv", col_types = cols(.default = "c")) %>% filter(!is.na(species))

joined <- dplyr::left_join(all_real_context, assigned, by = dplyr::join_by("scientificName"), suffix = c("", ".dup")) |>
  dplyr::select(-dplyr::ends_with(".dup"))

data.table::fwrite(joined, "big_data/gbif-howe-context-tracheophyta-2026-03-27-assigned-full-real-context.csv")
