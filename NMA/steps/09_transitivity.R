#===================================================================#
# Step 9. Transitivity 評估（Belavý 2024 方法；只出表格）
#   需要：rawdata
#   產出：trans_node → transitivity_node_<tag>.csv
#         trans_comp → transitivity_comp_<tag>.csv
#         trans_tests → transitivity_test_<tag>.csv
#===================================================================#

study_col <- cfg$cols$study
trt_col   <- cfg$cols$trt
mods_num  <- unname(cfg$trans_num)
mods_cat  <- unname(cfg$trans_cat)

# 取一個 study 內第一個非 NA 值（研究層級特徵在每個 arm 重複，空白列為 NA）
first_nonNA <- function(x) { x <- x[!is.na(x)]; x[1] }

#---- 1. 三種分析單位 -------------------------------------------------
# 每個 study × drug 一列
tr_arms0 <- dm %>%
  filter(!is.na(.data[[trt_col]])) %>%
  transmute(studylab = .data[[study_col]], treat = as.character(.data[[trt_col]])) %>%
  distinct()

# 每個 study 一列的特徵（study 是真正的獨立單位）
tr_study <- dm %>%
  group_by(studylab = .data[[study_col]]) %>%
  summarise(across(all_of(c(mods_num, mods_cat)), first_nonNA), .groups = "drop")

# Node 層級：study × drug，附上研究特徵
tr_arms <- tr_arms0 %>% left_join(tr_study, by = "studylab")

# Comparison 層級：同一研究內所有藥物兩兩配對
# （多臂研究會展開成多個配對；treat1 < treat2 避免 A-B、B-A 重複）
tr_pairs <- tr_arms0 %>%
  inner_join(tr_arms0, by = "studylab", suffix = c("1", "2"),
             relationship = "many-to-many") %>%
  filter(treat1 < treat2) %>%
  transmute(studylab, comparison = paste(treat1, "vs.", treat2)) %>%
  left_join(tr_study, by = "studylab")

#---- 2. 描述表（Node 與 Comparison）----------------------------------
fmt_rng <- function(x) {                     # 中位數 (最小-最大)
  x <- x[!is.na(x)]
  if (!length(x)) return("NA")
  sprintf("%.1f (%.1f-%.1f)", median(x), min(x), max(x))
}

describe_by <- function(df, key) {
  out <- df %>%
    group_by(.data[[key]]) %>%
    summarise(k = n_distinct(studylab), .groups = "drop")   # 研究數

  # 連續型：中位數 (範圍)、有資料的研究數 n / k
  for (lab in names(cfg$trans_num)) {
    m <- cfg$trans_num[[lab]]
    out <- out %>% left_join(
      df %>% group_by(.data[[key]]) %>%
        summarise(!!sprintf("%s, median (range)", lab) := fmt_rng(.data[[m]]),
                  !!sprintf("%s n/k", lab) := sprintf("%d | %d",
                      n_distinct(studylab[!is.na(.data[[m]])]), n_distinct(studylab)),
                  .groups = "drop"),
      by = key)
  }

  # 類別型：各類別的次數，例如 "ROBINS-I (Low/Moderate/Serious)" = "3 | 5 | 1"
  for (lab in names(cfg$trans_cat)) {
    m    <- cfg$trans_cat[[lab]]
    lvls <- sort(unique(na.omit(df[[m]])))
    out  <- out %>% left_join(
      df %>% group_by(.data[[key]]) %>%
        summarise(!!sprintf("%s (%s)", lab, paste(lvls, collapse = "/")) :=
                    paste(sapply(lvls, function(v) sum(.data[[m]] == v, na.rm = TRUE)),
                          collapse = " | "),
                  .groups = "drop"),
      by = key)
  }

  arrange(out, desc(k))
}

trans_node <- describe_by(tr_arms,  "treat")      %>% rename(Node = treat)
trans_comp <- describe_by(tr_pairs, "comparison") %>% rename(Comparison = comparison)

#---- 3. 組間差異檢定（Belavý 規則）-----------------------------------
# 只納入「該 modifier 有值、且該組 ≥2 個研究」的組別
keep_groups <- function(df, key, m) {
  df %>%
    filter(!is.na(.data[[m]])) %>%
    group_by(.data[[key]]) %>%
    filter(n_distinct(studylab) >= 2) %>%
    ungroup()
}

# Shapiro-Wilk 檢查 ANOVA 殘差是否常態：p ≥ 0.05 → ANOVA；否則 → Kruskal-Wallis
test_belavy <- function(df, key, m) {
  dd <- keep_groups(df, key, m)
  if (n_distinct(dd[[key]]) < 2) return(tibble(groups = n_distinct(dd[[key]])))
  f  <- as.formula(paste(m, "~ factor(", key, ")"))
  an <- aov(f, data = dd)
  sh <- tryCatch(shapiro.test(residuals(an))$p.value, error = function(e) NA_real_)
  use_anova <- !is.na(sh) && sh >= 0.05
  tibble(groups    = n_distinct(dd[[key]]),
         Shapiro_p = sh,
         Test      = if (use_anova) "ANOVA" else "Kruskal-Wallis",
         p         = if (use_anova) summary(an)[[1]][["Pr(>F)"]][1]
                     else kruskal.test(f, data = dd)$p.value)
}

trans_tests <- bind_rows(lapply(mods_num, function(m) {
  bind_rows(
    test_belavy(tr_arms,  "treat",      m) %>% mutate(Level = "Node"),
    test_belavy(tr_pairs, "comparison", m) %>% mutate(Level = "Comparison")
  ) %>% mutate(Modifier = m, .before = 1)
})) %>%
  select(any_of(c("Modifier", "Level", "groups", "Shapiro_p", "Test", "p"))) %>%
  mutate(across(any_of(c("Shapiro_p", "p")), ~ round(.x, 3)))

print(trans_node); print(trans_comp); print(trans_tests)
save_table(trans_node,  "transitivity_node")
save_table(trans_comp,  "transitivity_comp")
save_table(trans_tests, "transitivity_test")
