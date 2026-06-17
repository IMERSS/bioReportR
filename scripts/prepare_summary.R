library(dplyr)
library(tidyr)
library(stringr)
library(sf)

source("scripts/utils.R")

# reduce columns ready for assignment

rawList <- timedFread("tabular_data/AHSBR_Tracheophyta_ultimate-list_2026-06-16.csv")
reducedList <- rawList %>% select(c("taxonName", "introduction_status", "occurrence_status", "infrataxon_status", "provincial_concern", "provenance_status", "solow_EP", "phylum"))
reducedList <- reducedList %>% rename("reportingStatus" = "occurrence_status", "scientificName" = "taxonName")

timedWrite(reducedList, "tabular_data/AHSBR_Tracheophyta_ultimate-merged-summary_2026-06-16-orig.csv")

# Next: node ../bagatelle/src/assignBNames.js tabular_data/AHSBR_Tracheophyta_ultimate-merged-summary_2026-06-16-orig.csv --DwCA --swaps tabular_data/taxon-swaps.csv
