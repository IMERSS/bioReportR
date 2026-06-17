library(dplyr)
library(stringr)
library(sf)

source("scripts/utils.R")

# DISUSED FILE from old workflow where we expected to assign and align catalogue and summary ourselves

assignedTaxa <- timedFread("tabular_data/Howe_Sound_vascular_plant_records_consolidated_2024-11-assigned-taxa.csv")
summary <- timedFread("tabular_data/vascular_plant_summary_resynthesized_2024-11-assigned.csv")
summary$inSummary = 1

merged <- assignedTaxa %>%
  full_join(summary %>% select(-commonName), by = c("iNaturalistTaxonName"))

timedWrite(merged, "tabular_data/Howe_Sound_vascular_plant_records_consolidated_2024-11-prepared-taxa.csv")
