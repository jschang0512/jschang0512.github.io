#===================================================================#
# Step 2. 網絡圖
#   需要：net
#   產出：net_graph、netgraph → network_graph_<tag>.png
#===================================================================#

net_graph <- as.igraph(net)

netgraph <- ggraph(net_graph, layout = "linear", circular = TRUE) +
  geom_edge_link(
    aes(width = .nstudy,
        label = ifelse(.nstudy > 1, .nstudy, "")),
    angle_calc    = "along",        # 數字順著線條旋轉
    label_dodge   = unit(1, "mm"),  # 防撞距離，讓數字不被線條遮擋
    color         = "#C9D5D4",
    label_size    = 4,
    fontface      = "bold",
    label_colour  = "black",
    label_alpha   = 0.7,
    label_pos     = 0.44
  ) +
  geom_node_point(size = 12, color = "#a1adc8", alpha = 1) +
  geom_node_text(
    aes(label = name,
        # 座標放大 1.15 倍，文字往外推離圓心
        x = x * 1.15,
        y = y * 1.15,
        # 右半邊靠左對齊、左半邊靠右對齊，避免跟圓圈重疊
        hjust = ifelse(x > 0, 0, 1)),
    color = "black", fontface = "bold", size = 4
  ) +
  scale_edge_width(range = c(1, 10), guide = "none") +
  scale_x_continuous(expand = expansion(mult = 0.2)) +
  scale_y_continuous(expand = expansion(mult = 0.1)) +
  coord_fixed() +
  theme_void() +
  labs(title = cfg$title) +
  theme(
    plot.title       = element_text(hjust = 0.5, face = "bold", size = 16),
    plot.background  = element_rect(fill = "white", color = NA),
    panel.background = element_rect(fill = "white", color = NA)
  )

netgraph
save_plot(netgraph, "network_graph", width = 6, height = 6, scale = 2.2)
