



library(readr)
library(dplyr)
library(data.table)

## Stanza 1: Reduce incoming GBIF data to one row per taxa

read_GBIF = function (filename) {
  sr_time <- Sys.time()
  # Advice from https://discourse.gbif.org/t/problem-parsing-large-occurrence-downloads/2570
  rawGbif <- readr::read_tsv(filename, quote="", col_types = cols(.default = "c"))
  elapsed <- round(as.numeric(difftime(Sys.time(), sr_time, units = "secs")), 2)
  message(sprintf("Read %d lines in %.2f s", nrow(rawGbif), elapsed))
  rawGbif
}

allcat <- read_GBIF("big_data/gbif-howe-context-all-category-2026-03-06-raw.tsv")
# Rough and ready, just resolve data at species level
allcat$scientificName <- allcat$species

allcat_reduced <- allcat[!duplicated(allcat$scientificName), ] %>% filter(!is.na(scientificName))

write.csv(allcat_reduced, "big_data/gbif-howe-context-all-category-2026-03-06-reduced.csv", row.names = FALSE, na = "", fileEncoding = "UTF-8")

## Stanza 2: Compare GBIF data without taxon restriction to that questioned, which was:
##Ochrophyta, Plantae, Animalia, Fungi, Protozoa


allall <- read_GBIF("big_data/gbif-howe-context-all-2026-03-06-raw.tsv")
allall$scientificName <- allall$species

allall_reduced <- allall[!duplicated(allall$species), ]

write.csv(allcat_reduced, "big_data/gbif-howe-context-all-2026-03-06-reduced.csv", row.names = FALSE, na = "")

s1 <- dplyr::anti_join(allcat_reduced, allall_reduced, by=c("species"))
s2 <- dplyr::anti_join(allall_reduced, allcat_reduced, by=c("species"))

## Stanza 3: Reconstitute original "assigned" data by joining with assigned reduced data

assigned <- readr::read_csv("big_data/gbif-howe-context-all-category-2026-03-06-assigned.csv", col_types = cols(.default = "c")) %>% filter(!is.na(species))

joined <- dplyr::left_join(allcat, assigned, by = dplyr::join_by("scientificName"), suffix = c("", ".dup")) |>
  dplyr::select(-dplyr::ends_with(".dup"))

data.table::fwrite(joined, "big_data/gbif-howe-context-all-category-2026-03-06-assigned-full.csv")

## Stanza 3b: Reconstitute original "assigned" all data by joining with assigned reduced data

assignedall <- readr::read_csv("big_data/gbif-howe-context-all-2026-03-06-assigned.csv", col_types = cols(.default = "c")) %>% filter(!is.na(species))

joined <- dplyr::left_join(allall, assignedall, by = dplyr::join_by("scientificName"), suffix = c("", ".dup")) |>
  dplyr::select(-dplyr::ends_with(".dup"))

data.table::fwrite(joined, "big_data/gbif-howe-context-all-2026-03-06-assigned-full.csv")
