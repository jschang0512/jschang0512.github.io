#===================================================================#
# Step 1. 讀取資料、建立網絡
#   產出：rawdata、dm、net
#===================================================================#

if (grepl("\\.csv$", cfg$data_file, ignore.case = TRUE)) {
  rawdata <- read.csv(cfg$data_file, check.names = FALSE)
} else {
  rawdata <- read_excel(cfg$data_file, sheet = cfg$data_sheet)
}

rawdata <- rawdata %>%
  select(any_of(cfg$keep_cols), all_of(unname(unlist(cfg$cols))))

# 有 id 欄位時，去掉空白分隔列
if ("id" %in% names(rawdata)) rawdata <- filter(rawdata, !is.na(id))

# Coeff == "Y" 的研究依 ρ 調整 SE：SE × √ρ（變異數 × ρ）
# 每個 ρ 建一個欄位（selogTE0.25 ...）
for (rho in unique(c(cfg$rho_values, cfg$rho_main))) {
  se <- rawdata[[cfg$cols$se]]
  rawdata[[se_col(rho)]] <- if_else(rawdata[[cfg$cols$coeff]] %in% "Y", se * sqrt(rho), se)
}

dm  <- as.data.frame(rawdata)
net <- build_network(dm)

print(net)
