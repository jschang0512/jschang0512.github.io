# 貝氏網絡統合分析（NMA）流程

用 [multinma](https://dmphillippo.github.io/multinma/) 做 contrast-based（log HR）的貝氏隨機效應 NMA，從讀資料到敏感度分析分成 11 個步驟。

## 檔案結構

```
NMA/
├── config.R              ← 所有設定（研究名稱、路徑、MCMC、敏感度情境…）
├── run_all.R             ← 一鍵跑完全部步驟
├── R/functions.R         ← 共用函數（建網絡、跑模型、存檔）
└── steps/
    ├── 01_data.R                  讀資料、依 ρ 調整 SE、建立網絡
    ├── 02_network_graph.R         網絡圖
    ├── 03_main_model.R            主模型、先驗/後驗分佈圖
    ├── 04_forest_plot.R           相對效應森林圖（vs 參考組）
    ├── 05_ranking.R               排名機率、SUCRA
    ├── 06_nodesplit.R             Node-splitting、不一致性表（GRADE 用）
    ├── 07_league_table.R          League table
    ├── 08_global_inconsistency.R  UME 模型、DIC、離差-槓桿圖
    ├── 09_transitivity.R          Transitivity 評估（Belavý 2024）
    ├── 10_meta_regression.R       Network meta-regression
    └── 11_sensitivity.R           敏感度分析
```

## 使用步驟

### 1. 準備資料

Excel 或 CSV，每列是一個 study arm（contrast-based 格式）：

| 欄位 | 說明 |
|---|---|
| `studylab` | 研究名稱，如 `Samaras K, 2020` |
| `treat` | 治療組 |
| `logTE` | log HR；每個研究的參考組那一列留空 |
| `selogTE` | log HR 的標準誤 |
| `Coeff` | `Y` 表示需依相關係數 ρ 調整 SE |
| `Sex`、`Age`、`Followup`、`Region_category`、`ROBINS` | 研究特徵（transitivity、meta-regression 用） |

欄位名稱不同時，改 `config.R` 的 `cfg$cols` 即可。

### 2. 修改 `config.R`

最少要改這幾項：

```r
cfg$outcome_label  <- "All-cause dementia"   # 圖表標題
cfg$analysis_label <- "ITT"
cfg$file_tag       <- "dementia"             # 輸出檔名後綴

cfg$data_file  <- "路徑/hrdata.xlsx"
cfg$data_sheet <- "AllCause_ITT"
cfg$out_dir    <- "路徑/輸出資料夾"
```

其餘可調整：參考組、ρ、MCMC 次數與先驗、meta-regression 共變項、敏感度分析情境、圖表範圍。

### 3. 執行

在 RStudio 開啟 `run_all.R`，按 **Source**。

- 想只跑部分步驟，把 `run_all.R` 裡 `steps` 不需要的那行註解掉。後面的步驟會用到前面的結果，每個步驟檔開頭都有寫「需要」哪些物件。
- 跑過的模型會存在 `out_dir/models/`，下次直接讀取，不用重跑 MCMC。**改了資料或 MCMC 設定後**，請把 `cfg$reuse_models` 設成 `FALSE`，或刪掉 `models` 資料夾。

### 4. 輸出

全部存在 `out_dir`，檔名都帶 `file_tag`：

| 步驟 | 圖 | 表 |
|---|---|---|
| 02 | `network_graph_<tag>.png` | |
| 03 | `prior_posterior_<tag>.png` | `nmadata_<tag>.csv` |
| 04 | `forestplot_<tag>.png` | `forestdata_<tag>.csv`、`forestrawdata_<tag>.csv` |
| 05 | `rankplot_<tag>.png` | `sucradata_<tag>.csv` |
| 06 | `nodesplit1_<tag>.png`… | `incons_tbl_<tag>.csv` |
| 07 | | `league_table_<tag>.csv` |
| 08 | `ume_<tag>.png`、`dicplot_<tag>.png` | |
| 09 | | `transitivity_node/comp/test_<tag>.csv` |
| 10 | | `reg_<tag>.csv` |
| 11 | | `sens_<tag>.csv` |

最後會存一份 `workspace_<tag>.RData`，可用 `load()` 讀回所有物件。

## 換一個 outcome

1. 複製 `config.R`，例如 `config_alzheimer.R`，改研究名稱、資料工作表、輸出資料夾。
2. 指定設定檔後執行：

```r
config_file <- "config_alzheimer.R"
source("run_all.R")
```

## 備註

- `all_cause_dementia_ITT.R` 是整理前的原始單一檔版本，保留作為對照。
