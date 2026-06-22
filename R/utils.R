library(googledrive)
library(stringr)

# Helpful utility to template an arbitrary list of string arguments and then dump them to the console with a terminating newline
wg <- function (...) {
  args <- list(...)
  line <- paste(sapply(args, str_glue, .envir = parent.frame()), collapse = "")
  
  # Output the result using writeLines
  writeLines(line)
}

# Other incarnation at https://github.com/usda-nifa-b-team/b-team/blob/main/scripts/utils.R

downloadGdrive <- function (id, file_path, overwrite = FALSE) {
  if (overwrite || !file.exists(file_path)) {
    drive_download(as_id(id), path = file_path, overwrite = TRUE)
  }
}

idToDrib <- function (id) {
  path <- str_glue("https://drive.google.com/drive/folders/{id}")
  drib <- drive_get(as_id(path))
}

# Adapted from https://stackoverflow.com/a/64687628
downloadGdriveFolder <- function (id, file_path, skip_if_exists = TRUE, type = "csv") {
  exists <- file.exists(file_path)
  if (!exists || !skip_if_exists) {
    if (!exists) {
      dir.create(file_path)
    }
    # folder link to id
    folder_drib = idToDrib(id)
    
    # find files in folder
    files = drive_ls(folder_drib)
    
    cat("Fetching ", nrow(files), " files in folder ", folder_drib$name, "\n")
    
    # loop dirs and download files inside them
    for (i in seq_along(files$name)) {
      resource <- files$drive_resource[[i]]
      
      target <- str_c(file_path, "/", resource$name)
      if (resource$mimeType == "application/vnd.google-apps.folder") {
        cat (resource$name, " is a folder\n")
        downloadGdriveFolder(resource$id, target, skip_if_exists)
        # If there were subfolders, this would list them:
        # i_dir = drive_ls(files[i, ])
      }
      else {
        driveDownloadArgs <- list(
          file = as_id(files$id[i]),
          path = target,
          overwrite = !skip_if_exists
        )
        if (resource$mimeType == "application/vnd.google-apps.spreadsheet") {
          driveDownloadArgs$type <- type
          target <- str_c(target, ".csv")
        }
        wg("Got resource with type {resource$mimeType}")
        try({
          if (file.exists(target)) {
            wg("File {target} already exists, skipping download")
          } else {
            do.call(drive_download, driveDownloadArgs)
          } 
        })
      }
    }
  } else {
    wg("Path {file_path} already exists, skipping download\n")
  }
}


#' Execute a JavaScript file using Node.js
#'
#' Looks for the Node.js executable in the directory specified by the
#' environment variable R_NODE_PATH. If not found, assumes "node" is
#' available on the system PATH.
#'
#' @param js_file String. Path to the JavaScript file to execute.
#' @param args Character vector. Additional arguments to pass to the script (optional).
#' @param ... Further arguments passed to system2().
#' @return Integer exit status of the node process.
run_js <- function(js_file, args = character(), ...) {
  node_dir <- Sys.getenv("R_NODE_PATH", unset = "")
  
  # If R_NODE_PATH is set, construct full path to node
  if (nzchar(node_dir)) {
    node_path <- file.path(node_dir, "node")
  } else {
    node_path <- "node" # assume system path
  }
  
  if (!file.exists(js_file)) {
    stop("JavaScript file not found: ", js_file)
  }
  
  status <- system2(node_path, args = c(js_file, args), ...)
  if (status == 127) {
    stop("Unable to complete build - node.js is not installed. Please install from https://nodejs.org/en/download")
  } else if (status != 0) {
    stop(sprintf("Build failed with exit status %d.", status))
  }
  return(status)
}
