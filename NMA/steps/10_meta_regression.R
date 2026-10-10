#===================================================================#
# Step 10. Network meta-regression
#   需要：dm、sucra_data（Step 5；reg_drug_order 為 NULL 時用來排序）
#   產出：reg_fits、reg_summary（各模型摘要）、beta_df、tau_df
#         tab_wide → reg_<tag>.csv
#===================================================================#

reg_fits <- list()

for (lab in names(cfg$reg_covariates)) {
  cov <- cfg$reg_covariates[[lab]]

  # 只用該共變項有值的資料；參考組固定為 ref_trt
  net_cov <- build_network(dm %>% filter(!is.na(.data[[cov]])), trt_ref = cfg$ref_trt)

  reg_fits[[lab]] <- run_nma(
    paste0("reg_", cov), net_cov,
    regression = as.formula(paste("~ .trt:", cov)),   # .trt 代表治療效應
    control    = cfg$mcmc$reg_control
  )
}

# 各模型摘要：tau 保留原尺度，其餘取 exp
reg_summary <- lapply(reg_fits, function(fit) {
  as.data.frame(summary(fit)) %>%
    mutate(`mean(95%CI)` = ifelse(
      parameter == "tau",
      sprintf("%.3f [%.3f, %.3f]", mean, `2.5%`, `97.5%`),
      sprintf("%.3f [%.3f, %.3f]", exp(mean), exp(`2.5%`), exp(`97.5%`)))) %>%
    select(parameter, `mean(95%CI)`, Bulk_ESS, Tail_ESS, Rhat)
})
print(reg_summary)

#---- 抽出交互作用係數 beta 與 tau -------------------------------------
# 連續型：Covariate = 顯示名稱
# 類別型：Covariate = "Region: Western vs Eastern"（基準為字母順序第一個）
covariate_label <- function(lab, cov, term) {
  x <- dm[[cov]]
  if (is.numeric(x)) return(rep(lab, length(term)))
  base  <- sort(unique(na.omit(as.character(x))))[1]
  level <- sub(paste0("^", cov), "", term)
  sprintf("%s: %s vs %s", lab, level, base)
}

extract_beta <- function(fit, lab) {
  cov <- cfg$reg_covariates[[lab]]
  as.data.frame(summary(fit)) %>%
    filter(str_detect(parameter, "^beta\\[")) %>%
    mutate(
      Drug      = str_match(parameter, "\\.trt([^:]+):")[, 2],
      term      = str_match(parameter, ":(.+)\\]$")[, 2],
      Covariate = covariate_label(lab, cov, term),
      HRR = exp(mean), lo = exp(`2.5%`), hi = exp(`97.5%`)
    ) %>%
    select(Covariate, Drug, HRR, lo, hi)
}

beta_df <- imap_dfr(reg_fits, ~ extract_beta(.x, .y)) %>%
  mutate(sig    = lo > 1 | hi < 1,
         sparse = Drug %in% cfg$reg_sparse_trts | hi / lo > 8,   # 單一研究、先驗主導
         group  = case_when(sig    ~ "CrI excludes 1",
                            sparse ~ "Sparse / prior-driven",
                            TRUE   ~ "Other"),
         label  = sprintf("%.3f [%.3f, %.3f]%s", HRR, lo, hi, if_else(sig, " *", "")))

tau_df <- imap_dfr(reg_fits, ~ as.data.frame(summary(.x)) %>%
                     filter(parameter == "tau") %>%
                     transmute(Covariate = .y,
                               `tau (95% CrI)` = sprintf("%.3f [%.3f, %.3f]",
                                                         mean, `2.5%`, `97.5%`)))
print(tau_df)

#---- 合併表（藥物 × 共變項）-------------------------------------------
drug_order <- cfg$reg_drug_order
if (is.null(drug_order)) drug_order <- sucra_data %>% arrange(desc(sucra)) %>% pull(parameter)

tab_wide <- beta_df %>%
  select(Drug, Covariate, label) %>%
  pivot_wider(names_from = Covariate, values_from = label) %>%
  mutate(Drug = factor(Drug, drug_order)) %>%
  arrange(Drug) %>%
  select(Drug, any_of(unique(beta_df$Covariate))) %>%
  mutate(across(-Drug, ~ replace_na(.x, "NA")))

print(tab_wide)
save_table(tab_wide, "reg")
