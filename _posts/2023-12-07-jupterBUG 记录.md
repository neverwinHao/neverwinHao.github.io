# jupyter导入新的虚拟环境

---
layout: post
title: jupyter导入新的虚拟环境
date: 2023-12-07
tags: markdown   
---

## 第一步

```
# 将虚拟环境导入Jupyter 的kernel 中
python -m ipykernel install --user --name=环境名
```

## 第二步

终端输入

```py
import sys
sys.executable
```

记住路径，再次输入

```
ipython kernelspec list
```

进入对应的位置，修改json文件

## 第三步

进入这个位置D:\Anaconda\envs\face\Scripts

```bash
pip install ipykernel
```

### 服务器端配置

```pyhton
# Configuration file for jupyter-notebook.
c.NotebookApp.ip = '*'
c.NotebookApp.open_browser = False
c.NotebookApp.port = 8989
c.NotebookApp.enable_mathjax = True        # 启用 MathJax
c.NotebookApp.allow_remote_access = True   #允许远程访问
c.NotebookApp.allow_root = True
c = get_config()  #noqa
```



