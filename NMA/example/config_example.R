#===================================================================#
# 示範設定：沿用 config.R，只覆寫與示範資料有關的項目
#
# 執行方式（在 NMA 資料夾）：
#   config_file <- "example/config_example.R"
#   source("run_all.R")
#===================================================================#

source("config.R", encoding = "UTF-8")

cfg$outcome_label  <- "Example outcome"
cfg$analysis_label <- "ITT"
cfg$file_tag       <- "example"
cfg$title          <- sprintf("%s (%s)", cfg$outcome_label, cfg$analysis_label)

cfg$data_file <- "example/example_data.csv"
cfg$out_dir   <- "example/output"

# 示範資料較小，減少抽樣次數加快速度
cfg$mcmc$iter   <- 4000
cfg$mcmc$warmup <- 1000

cfg$reg_sparse_trts <- character(0)
cfg$reg_drug_order  <- NULL           # 依 SUCRA 排序

cfg$sensitivity[["DIC<3"]] <- NULL
cfg$sensitivity[["Exclude Study 1"]] <- list(drop_studies = "Study 1, 2011")
