library(dplyr)
library(stringr)
library(sf)

source("scripts/utils.R")

runDataset = "Howe";

datasets <- list(
  Howe = list(
    obs_file = "tabular_data/AHSBR_Tracheophyta_ultimate-catalogue_2026-06-16-selected-orig.csv",
    shp_index_file = "tabular_data/Howe Shapefile Index.csv"
  )
)

obsFile <- datasets[[runDataset]]$obs_file;
shapeIndex = timedFread(datasets[[runDataset]]$shp_index_file);

prefix <- sub("(.*)-orig.*", "\\1", obsFile)

fix_case <- function(s) {
  if (str_detect(s, "^[A-Z\\W]+$")) {  # Check if the string is all uppercase (including non-alphabetic characters)
    return(tools::toTitleCase(tolower(s)))  # Convert to lowercase, then capitalize each word
  }
  return(s)  # Return unchanged if not all caps
}

# Extract the filename, remove the extension, and replace underscores with spaces
Label <- basename(shapeIndex$File) %>%
  sub("\\.shp$", "", .) %>%
  gsub("_", " ", .)

shapeIndex$Label = ifelse(shapeIndex$Label == "" | is.na(shapeIndex$Label), Label, shapeIndex$Label)

# Necessary otherwise we get Loop 0 is not valid: Edge x has duplicate vertex with edge y. since S2 library is fussy about geometry
sf::sf_use_s2(FALSE)


rawObs <- timedFread(obsFile)

emptyCols <- colSums(is.na(rawObs)) == nrow(rawObs)

emptyColNames = names(emptyCols[emptyCols])
cat("Removing ", length(emptyColNames), " empty columns ", paste(emptyColNames, collapse = ", "))

rawObs <- rawObs[!emptyCols]

filteredObs <- rawObs %>% filter(!is.na(genus) & iNaturalistTaxonId != 0)

filteredObs.sf <- st_as_sf(filteredObs, coords = c("decimalLongitude", "decimalLatitude"), crs=4326, na.fail = FALSE) # CRS is WGS:1984

filteredObs.labels <- filteredObs

regionIndirection <- data.frame()

for(i in 1:nrow(shapeIndex)) {
  row <- shapeIndex[i,]
  fileName <- str_glue("spatial_data/vectors/{row$File}")
  wg("Reading {fileName} for row {i}")
  read.start <- Sys.time()
  shape <- mx_read(fileName)
  if (is.na(st_crs(shape))) {
    st_crs(shape) = 4326
  }
  read.end <- Sys.time()
  wg("Read {nrow(shape)} polygons in {format(read.end - read.start)}")
  bench.start <- Sys.time()
  # Ignore message "although coordinates are longitude/latitude, st_intersects assumes that they are planar"
  suppressMessages(rawintersects <- st_intersects(filteredObs.sf, shape))
  multiple <- which(lengths(rawintersects) > 1)
  cmultiple = length(multiple)
  if (cmultiple > 0) {
    wg("Warning: {cmultiple} observations have intersected multiple regions:")
    wg("Sample observation at index {multiple[1]}:")
    oneMultiple <- rawintersects[[multiple[1]]]
    wg("Lies in shape rows {oneMultiple[1]} label {shape[[oneMultiple[1],row$Field]]} and {oneMultiple[2]} label {shape[[oneMultiple[2],row$Field]]}")
  }
  intersection <- sapply(rawintersects, function(x) if (length(x) > 0) x[1] else NA_integer_)

  bench.end <- Sys.time()
  wg("Intersected {nrow(shape)} polygons from {row$File} in {format(bench.end - bench.start)}")
  intset = sort(na.omit(unique(intersection)))
  shapecols <- st_drop_geometry(shape)
  # Replace all NA elements in the column with the NullAs field if it is there
  shapecol <- dplyr::coalesce(shapecols[,row$Field], row$NullAs)
  # One field value for each shape in the shapefile
  shapeFieldValues <- `if`(row$Field == "<none>", row[["Example value 1"]], unname(sapply(shapecol, fix_case)))
  uniqueLabels <- unique(shapeFieldValues[intset])
  # Sort ecozones by numeric prefix - these will now become output indices
  sortUniqueLabels = `if`(is.na(row$SortNumeric), sort(uniqueLabels), uniqueLabels[order(as.numeric(sub("^(\\d+)+.*", "\\1", uniqueLabels)))])

  obsFieldValues = shapeFieldValues[intersection]

  labelIndex = match(obsFieldValues, sortUniqueLabels)
  if (length(sortUniqueLabels) > 0) {
    wg("About to index {row$Label}")
    indirectionRows <- data.frame(regionField = row$Label, id = 1:length(sortUniqueLabels), label = sortUniqueLabels)
    regionIndirection <- rbind(regionIndirection, indirectionRows)
  } else {
    wg("Regions for column ${row$Label} did not match any observations")
  }

  filteredObs.labels[row$Label] = labelIndex
}


# Better formatting for ecoregion names
#regionIndirection <- regionIndirection %>% mutate(label = str_replace_all(label, "  ", ". "))

#ecoColumn <- "US Ecoregions Level IV"

#withoutEco <- plant.poll.labels[is.na(plant.poll.labels[ecoColumn]), ]
#plant.poll.labels <- plant.poll.labels[!is.na(plant.poll.labels[ecoColumn]), ]

#cat("Discarded ", nrow(withoutEco), " observations as not assigned to an ecoregion\n")

#timedWrite(withoutEco, str_glue("{prefix}-ecoregion-discarded.csv"))


timedWrite(filteredObs.labels, str_glue("{prefix}-labels.csv"))

timedWrite(regionIndirection, str_glue("{prefix}-regionIndirection.csv"))
