#===================================================================#
# NMA 全流程（multinma，貝氏隨機效應模型，contrast-based log HR）
#
# 使用方式：
#   1. 修改 config.R（研究名稱、資料路徑、輸出資料夾等）
#   2. 在 RStudio 開啟本檔，按 Source；或在 R 執行 source("run_all.R")
#   3. 只想跑部分步驟：把下方 steps 裡不需要的那行註解掉
#      （後面的步驟會用到前面步驟的結果，見各檔案開頭的「需要」）
#===================================================================#

# 切換到本檔所在資料夾，讓下面的相對路徑找得到
this_file <- tryCatch(sys.frame(1)$ofile, error = function(e) NULL)
if (is.null(this_file) && requireNamespace("rstudioapi", quietly = TRUE) &&
    rstudioapi::isAvailable()) {
  this_file <- rstudioapi::getSourceEditorContext()$path
}
if (!is.null(this_file) && nzchar(this_file)) setwd(dirname(this_file))

source("R/functions.R", encoding = "UTF-8")
# 設定檔：預設 config.R；換 outcome 時可先設定 config_file 再 source 本檔
if (!exists("config_file")) config_file <- "config.R"
source(config_file, encoding = "UTF-8")

options(mc.cores = min(cfg$mcmc$chains, parallel::detectCores()))   # 各條鏈平行跑

steps <- c(
  "steps/01_data.R",                  # 讀資料、建立網絡
  "steps/02_network_graph.R",         # 網絡圖
  "steps/03_main_model.R",            # 主模型、先驗/後驗圖
  "steps/04_forest_plot.R",           # 森林圖
  "steps/05_ranking.R",               # 排名、SUCRA
  "steps/06_nodesplit.R",             # Node-splitting、不一致性表
  "steps/07_league_table.R",          # League table
  "steps/08_global_inconsistency.R",  # UME、離差-槓桿圖
  "steps/09_transitivity.R",          # Transitivity
  "steps/10_meta_regression.R",       # Meta-regression
  "steps/11_sensitivity.R"            # 敏感度分析
)

for (s in steps) {
  message("\n==== ", s, " ====")
  source(s, encoding = "UTF-8", echo = FALSE, print.eval = TRUE)
}

# 存下所有物件，之後可用 load() 直接讀回
save.image(out_path("workspace", "RData"))
message("\n完成，結果在：", cfg$out_dir)
