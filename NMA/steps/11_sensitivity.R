#===================================================================#
# Step 11. 敏感度分析
#   需要：dm、fit_re（Step 3）
#   產出：sens_fits、conb_sens_te → sens_<tag>.csv
#
# 情境在 config.R 的 cfg$sensitivity 設定，每個情境一欄
#===================================================================#

sens_fits <- list()
sens_cols <- list()

for (lab in names(cfg$sensitivity)) {
  s <- cfg$sensitivity[[lab]]

  if (isTRUE(s$main)) {
    sens_cols[[lab]] <- hr_vs_ref(fit_re, lab)
    next
  }

  d <- dm
  if (!is.null(s$filter))       d <- d %>% filter(!!s$filter)
  if (!is.null(s$drop_studies)) d <- d %>% filter(!.data[[cfg$cols$study]] %in% s$drop_studies)
  rho <- if (is.null(s$rho)) cfg$rho_main else s$rho

  sens_fits[[lab]] <- run_nma(paste0("sens_", make.names(lab)), build_network(d, rho = rho))
  sens_cols[[lab]] <- hr_vs_ref(sens_fits[[lab]], lab)
}

# 以主分析的排序合併（主分析 HR 由小到大）
conb_sens_te <- hr_vs_ref(fit_re, ".main") %>%
  select(Treatment) %>%
  { Reduce(function(acc, x) left_join(acc, x, by = "Treatment"), sens_cols, .) }

print(conb_sens_te)
save_table(conb_sens_te, "sens")
