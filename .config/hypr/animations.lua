-- ┏━┓┏┓╻╻┏┳┓┏━┓╺┳╸╻┏━┓┏┓╻
-- ┣━┫┃┗┫┃┃┃┃┣━┫ ┃ ┃┃ ┃┃┗┫
-- ╹ ╹╹ ╹╹╹ ╹╹ ╹ ╹ ╹┗━┛╹ ╹

hl.config({ animations = { enabled = true } })

hl.curve("wind",   { type = "bezier", points = { {0.05, 0.9},   {0.1, 1.05}  } })
hl.curve("winIn",  { type = "bezier", points = { {0.76, 0.42},  {0.74, 0.87} } })
hl.curve("winOut", { type = "bezier", points = { {0.76, 0.42},  {0.74, 0.87} } })
hl.curve("workIn", { type = "bezier", points = { {0.72, -0.07}, {0.41, 0.98} } })
hl.curve("linear", { type = "bezier", points = { {1, 1},        {1, 1}       } })

hl.animation({ leaf = "windows",          enabled = true, speed = 6, bezier = "wind",   style = "popin" })
hl.animation({ leaf = "windowsIn",        enabled = true, speed = 1, bezier = "workIn", style = "popin" })
hl.animation({ leaf = "windowsOut",       enabled = true, speed = 5, bezier = "workIn", style = "popin" })
hl.animation({ leaf = "windowsMove",      enabled = true, speed = 5, bezier = "wind",   style = "slide" })

hl.animation({ leaf = "fadeIn",           enabled = true, speed = 2, bezier = "winIn" })
hl.animation({ leaf = "fadeOut",          enabled = true, speed = 5, bezier = "winOut" })

hl.animation({ leaf = "workspaces",       enabled = true, speed = 3, bezier = "workIn", style = "slidevert" })
hl.animation({ leaf = "specialWorkspace", enabled = true, speed = 5, bezier = "workIn", style = "slidevert" })
