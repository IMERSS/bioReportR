library(dplyr)

source("scripts/utils.R")

raw <- timedFread("big_data/bc-cdc_full_2026-04-10.csv")

reduced <- raw %>% filter(!is.na(phylum) & phylum != "" & `Classification Level` != "Population"
                          &!grepl("\\bsp\\.\\s*\\d+$", scientificName))

timedWrite(reduced, "big_data/bc-cdc_full_2026-04-10-reduced.csv")


newNames <- timedFread("big_data/bc-cdc_new-names_2026-04-10.csv")

reducedNew <- reduced %>% filter(scientificName %in% newNames$scientificName)

timedWrite(reducedNew, "big_data/bc-cdc_full_2026-04-10-new-reduced.csv")
