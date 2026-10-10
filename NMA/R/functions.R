#===================================================================#
# 共用函數：套件載入、建立網絡、跑模型、格式化、存檔
#===================================================================#

pkgCheck <- function(pkg){
  if (!requireNamespace(pkg, quietly = TRUE)) install.packages(pkg)
  library(pkg, character.only = TRUE)
}

for (pkg in c("multinma", "tidyverse", "scales", "patchwork", "ggsci",
              "igraph", "ggraph", "grid", "forestploter", "ggrepel", "readxl")) {
  pkgCheck(pkg)
}


#---- 格式化 --------------------------------------------------------

# log 尺度 → "HR [下界, 上界]"
fmt_hr <- function(m, l, u) sprintf("%.2f [%.2f, %.2f]", exp(m), exp(l), exp(u))

# 無方向配對鍵："A|B" 與 "B|A" 視為相同
pair_key <- function(a, b) paste(pmin(a, b), pmax(a, b), sep = "|")

# 去掉 multinma 參數名稱的方括號，例如 "d[SGLT2i]" → "SGLT2i"
strip_param <- function(x) sub(".*\\[(.*?)\\].*", "\\1", x)

# rho 對應的 SE 欄位名稱，例如 0.5 → "selogTE0.5"
se_col <- function(rho) paste0(cfg$cols$se, rho)


#---- 網絡與模型 ----------------------------------------------------

# 建立 contrast-based 網絡
build_network <- function(data, rho = cfg$rho_main, trt_ref = cfg$network_ref) {
  args <- list(
    data  = as.data.frame(data),
    study = as.name(cfg$cols$study),
    trt   = as.name(cfg$cols$trt),
    y     = as.name(cfg$cols$y),
    se    = as.name(se_col(rho))
  )
  if (!is.null(trt_ref)) args$trt_ref <- trt_ref
  do.call(set_agd_contrast, args)
}

# 跑 NMA；reuse_models = TRUE 時會把結果存成 RDS，下次直接讀取
#   name       : 模型名稱（也是 RDS 檔名）
#   regression : meta-regression 公式；NULL 為一般 NMA
run_nma <- function(name, net, consistency = "consistency", regression = NULL,
                    seed = NULL, control = NULL) {
  rds <- file.path(cfg$out_dir, "models", paste0(name, ".rds"))
  if (cfg$reuse_models && file.exists(rds)) {
    message("讀取已存的模型：", rds)
    return(readRDS(rds))
  }

  args <- list(
    net,
    consistency = consistency,
    trt_effects = "random",     # 隨機效應模型
    prior_trt   = cfg$mcmc$prior_trt,
    prior_het   = cfg$mcmc$prior_het,
    iter        = cfg$mcmc$iter,
    warmup      = cfg$mcmc$warmup,
    chains      = cfg$mcmc$chains
  )
  if (is.null(regression)) {
    args$likelihood <- "normal"   # log HR 服從常態分佈
    args$link       <- "identity" # 已經是 log 尺度
  } else {
    args$regression <- regression
    args$prior_reg  <- cfg$mcmc$prior_reg
  }
  if (!is.null(seed))    args$seed    <- seed
  if (!is.null(control)) args$control <- control

  fit <- do.call(nma, args)

  dir.create(dirname(rds), recursive = TRUE, showWarnings = FALSE)
  saveRDS(fit, rds)
  fit
}

# 相對於參考組的 HR，回傳一欄 "HR [95% CrI]"，欄名為 col_name
hr_vs_ref <- function(fit, col_name) {
  as.data.frame(relative_effects(fit, trt_ref = cfg$ref_trt)) %>%
    transmute(Treatment = as.character(.trtb),
              est = mean,
              !!col_name := fmt_hr(mean, `2.5%`, `97.5%`)) %>%
    arrange(est) %>%
    select(-est)
}


#---- 存檔 ----------------------------------------------------------

# 輸出檔名：name_tag.ext，例如 forestplot_dementia.png
out_path <- function(name, ext) {
  dir.create(cfg$out_dir, recursive = TRUE, showWarnings = FALSE)
  file.path(cfg$out_dir, sprintf("%s_%s.%s", name, cfg$file_tag, ext))
}

save_plot <- function(plot, name, width, height, scale = 2) {
  ggsave(out_path(name, "png"), plot = plot, width = width, height = height,
         units = "cm", dpi = cfg$plot$dpi, scale = scale, bg = "white")
}

save_table <- function(df, name) {
  write.csv(df, out_path(name, "csv"), row.names = FALSE)
}
