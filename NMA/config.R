#===================================================================#
# NMA 分析設定檔
#
# 換 outcome / 換資料時，原則上只需要改這個檔案。
# 改完後執行 run_all.R，或依序 source steps/ 裡的步驟。
#===================================================================#

cfg <- list()

#---- 1. 研究名稱（會用在圖表標題與輸出檔名）------------------------
cfg$outcome_label  <- "All-cause dementia"   # 結果名稱
cfg$analysis_label <- "ITT"                  # 分析族群，如 ITT / AT
cfg$file_tag       <- "dementia"             # 輸出檔名後綴，如 forestplot_dementia.png

# 圖表標題用，例如 "All-cause dementia (ITT)"
cfg$title <- sprintf("%s (%s)", cfg$outcome_label, cfg$analysis_label)


#---- 2. 檔案路徑 ----------------------------------------------------
cfg$data_file  <- "I:/我的雲端硬碟/糖尿病&神經退化疾病/Data/hrdata.xlsx"  # .xlsx 或 .csv
cfg$data_sheet <- "AllCause_ITT"                                          # .xlsx 才需要
cfg$out_dir    <- "I:/我的雲端硬碟/糖尿病&神經退化疾病/Result/all cause dementia_ITT"


#---- 3. 資料欄位 ----------------------------------------------------
# 每列是一個 study arm；參考組那一列的 logTE 為 NA（contrast-based 格式）
cfg$cols <- list(
  study  = "studylab",   # 研究名稱
  trt    = "treat",      # 治療組
  y      = "logTE",      # log HR
  se     = "selogTE",    # log HR 的標準誤
  coeff  = "Coeff"       # "Y" 表示需依相關係數 ρ 調整 SE
)
# 其餘要一起讀入的欄位（共變項等）
cfg$keep_cols <- c("id", "r", "n", "Sex", "Age", "Followup", "Region_category", "ROBINS")


#---- 4. 治療與參考組 ------------------------------------------------
cfg$ref_trt      <- "SoC"   # 相對效應、森林圖的比較基準
cfg$network_ref  <- NULL    # 主模型網絡的 trt_ref；NULL = multinma 自動選（與原始程式相同）
cfg$lower_better <- TRUE    # HR 越低越好（排名、SUCRA 用）


#---- 5. 相關係數 ρ（Coeff == "Y" 的研究調整 SE）----------------------
# 會建立 selogTE0.25、selogTE0.5、selogTE0.75 等欄位
cfg$rho_values <- c(0.25, 0.5, 0.75)
cfg$rho_main   <- 0.5       # 主分析使用的 ρ


#---- 6. MCMC 與先驗 ------------------------------------------------
cfg$mcmc <- list(
  prior_trt = multinma::normal(scale = 1.5),
  prior_het = multinma::half_normal(scale = 0.5),   # 異質性 τ 的先驗
  prior_reg = multinma::normal(scale = 1),          # meta-regression 係數的先驗
  iter      = 10000,   # 總抽樣次數
  warmup    = 2000,    # 預熱期（捨棄的次數）
  chains    = 4,       # MCMC 鏈數
  seed      = 12345,   # 只用在 node-splitting（與原始程式相同）
  reg_control = list(max_treedepth = 15, adapt_delta = 0.99)
)

# TRUE：已跑過的模型會存在 out_dir/models/，下次直接讀取不重跑
# 改了資料或 MCMC 設定後，請設成 FALSE 或刪掉 models 資料夾
cfg$reuse_models <- TRUE


#---- 7. Node-splitting ---------------------------------------------
cfg$nodesplit_per_page <- 10                # 每頁幾個比較
cfg$nodesplit_ticks    <- c(0.5, 1, 1.5, 3)


#---- 8. Transitivity -----------------------------------------------
# 連續型：名稱 = 表格顯示名稱，值 = 欄位名稱（會做 ANOVA / Kruskal-Wallis）
cfg$trans_num <- c("Age" = "Age", "Male %" = "Sex", "Follow-up y" = "Followup")
# 類別型：只做次數描述
cfg$trans_cat <- c("Region" = "Region_category", "ROBINS-I" = "ROBINS")


#---- 9. Meta-regression --------------------------------------------
# 名稱 = 表格顯示名稱，值 = 欄位名稱
# 類別型會自動顯示成 "Region: Western vs Eastern"（以字母順序第一個為基準）
cfg$reg_covariates <- c(
  "Sex"       = "Sex",
  "Age"       = "Age",
  "Follow-up" = "Followup",
  "Region"    = "Region_category",
  "ROBINS-I"  = "ROBINS"
)
cfg$reg_sparse_trts <- c("Glinide", "INS")  # 只有單一研究、結果由先驗主導的藥物
cfg$reg_drug_order  <- c("SGLT2i", "GLP1RA", "TZD", "DPP4i", "MET", "Glinide", "SU", "AGI", "INS")
                                            # NULL = 依 SUCRA 排序


#---- 10. 敏感度分析 ------------------------------------------------
# 每個情境是一欄；main = TRUE 代表主分析結果放在這個位置
#   rho          ：改用不同 ρ 的 SE
#   filter       ：保留符合條件的列（dplyr::filter 的條件式）
#   drop_studies ：排除指定研究
cfg$sensitivity <- list(
  "rho=0.25"                 = list(rho = 0.25),
  "rho=0.5"                  = list(main = TRUE),
  "rho=0.75"                 = list(rho = 0.75),
  "ROBINS-I without serious" = list(filter = quote(ROBINS != "Serious")),
  "DIC<3"                    = list(drop_studies = c("Samaras K, 2020", "Kuan YC, 2017"))
)


#---- 11. 圖表 ------------------------------------------------------
cfg$plot <- list(
  forest_xlim     = c(0, 2),
  forest_ticks    = NULL,          # NULL = 自動；例如 c(0.5, 1, 1.5, 2)
  prior_post_xlim = c(-1.5, 1.5),
  dpi             = 600
)
