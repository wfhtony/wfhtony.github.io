title: 【个人随笔】荣耀六root相关
id: 237
categories:
  - 雜談
date: 2014-10-20 01:05:37
tags:
---

反正又是心血来潮。。。（哪次不是=_=）
都心血來潮到了出現簡繁混用的情況了= =（二次編輯）
寫（整理）得很亂，還請各位輕噴。

轉載請隨意。

# <span style="color: #ff0000;">**[刷机需谨慎]**</span>
<!--more-->
先说说Root**基本流程**（華爲其他機型應該也是同理）：
> **1.** 解锁 Bootloader。
> **2.** 通过 Bootloader 刷入 第三方Recovery（如: CMW）。
> **3.** 通过 第三方Recovery 刷入 su 。
> （如果你要在Root同时能保证成功接收和安装OTA的话，请一定要做以下这一步。）
> **4.** （可選但建議） 通过 Bootloader 刷入 官方Recovery。
> **4.4.**（可選） 利用各種文件管理APP將"/system/app"中的 superuser.apk **剪切**到内部存儲的任意位置（刪除也可）
> **4.8.**（可選） 安裝剛剛剪切出來的 superuser.apk
> **5.** 進入Root权限管理工具，開啓“生存模式”
知道了流程那刷入Root的具体步骤也就清楚了。

Root的**具体步骤**（小白向）：
> **0.** [Android SDK](https://developer.android.com/sdk/index.html) 【直接下載（均含 Eclipse）：[32位(x86)](https://dl.google.com/android/adt/adt-bundle-windows-x86-20140702.zip) ；[64位](https://dl.google.com/android/adt/adt-bundle-windows-x86_64-20140702.zip)】 → ADB ( ~\adt-bundle-windows-x86 (或_64 ) \sdk\platform-tools )
> **1.** [获得Bootloader解锁码](http://www.emui.com/plugin.php?id=unlock)
> **2.** ADB → 通過Bootloader → 解锁Bootloader（[官方教程](http://www.emui.com/plugin.php?id=unlock&amp;mod=step)）
> **3.** ADB → 通過Bootloader → 刷入 第三方Recovery[（H60-L01 for Android 4.4）](http://bbs.anzhi.com/thread-9187865-1-2.html) [（H60-L02 for Android 4.4）](http://bbs.anzhi.com/thread-9150378-1-1.html) [（H60-L01 for Android 5.1）](http://bbs.zhiyoo.com/thread-9682883-1-1.html) [（H60-L02 for Android 5.1）](http://bbs.zhiyoo.com/thread-9677485-1-1.html)
> **4.** 重啓機器
> **5.** 進入第三方Recovery → 刷入Root包 [[SuperSU]](http://download.chainfire.eu/396/SuperSU/) [[Superuser (ChainDD)]](http://androidsu.com/superuser "(要科學上網)") [[Superuser (CMW)]](https://www.google.com/url?q=https://www.google.com/url?q%3Dhttp://download.clockworkmod.com/superuser/superuser.zip%26sa%3DD%26usg%3DAFQjCNGkkEFNNdbyuzVedlu9e82Du1g2BA&amp;sa=D&amp;usg=AFQjCNGPp7PcdR9porSHzHZ9x5BR7h6FOg) .
> **6.** （可選但建議）ADB → 通過Bootloader → 刷回官方Recovery（見下方**关于如何提取官方Recovery**部分）
> **6.4.**（可選） 利用各種文件管理APP將"/system/app"中的 superuser.apk **剪切**到内部存儲的任意位置（刪除也可）
> **6.8.**（可選） 安裝剛剛剪切出來的 superuser.apk
> **7.** 進入Root权限管理工具，開啓“生存模式”

Root的**具体步骤**（真·小白向）：
> **1.**  [获得Bootloader解锁码](http://www.emui.com/plugin.php?id=unlock)
> **2.** 前往 [這裏](http://jixun.org/p/2797) 下載刷機工具包
> **3.** 利用該刷機工具包刷入Root、第三方Recovery 和 刷回官方Recovery（可選但建議）（見下方**关于如何提取官方Recovery**部分）
> **注**：該刷機工具包的 各式recovery（在rec文件夾下） 和 superuser.zip **都是可以換的**【參考上文 Root的**具体步骤**（小白向） 部分的第3步、第5步和第6步】。
> **3.4.**（可選） 利用各種文件管理APP將"/system/app"中的 superuser.apk **剪切**到内部存儲的任意位置
> **3.8.**（可選） 安裝剛剛剪切出來的 superuser.apk
> **4.** 進入Root权限管理工具，開啓“生存模式”

**关于Root的刷入**，咱个人还是推荐自行手动刷入比较好，原因如下：
> **1.** 可自行选择Root权限管理工具（如：SuperSU）。
> **2.** 第三方Root工具有可能还会在手机中装上其他可能并不需要的应用。

**关于如何提取官方Recovery**:
> **1.** 下載**當前版本**（版本號可在設置中查看）的完整卡刷包（[官方下載地址](http://www.emui.com/plugin.php?id=hwdownload)）（**注意機型**）
> **2.** 提取卡刷包中的**UPDATE.APP** （可使用[這個工具](http://pan.baidu.com/wap/link?uk=3693319598&amp;shareid=554355587&amp;third=0)提取）
> **3.** 在提取出來的文件夾中尋找 **RECOVERY.IMG** 文件，這個就是所需要的**官方Recovery**了。

<hr />

**关于XPOSED**:

在華爲EMUI系統下雖然能裝XPOSED模塊，但是如果正常安裝的話會與其系统主題相衝突。

安裝時在 XPOSED安裝器 的 **設置** 中勾上 **禁用資源鈎子** 然後再安裝就行了。

不過目前按<span style="color: #ff0000;">咱个人的态度</span>是<span style="color: #ff0000;">不太建议</span>安装XPOSED的。
原因如下：
> **1.** 完整安装框架会和系统冲突，就算安装上也不能修改系统资源（说人话就是你就算安装了XPOSED，你也**不能正常且完整地**使用 App settings ; Gravitybox之类的软件了）。
> **2.**<del>部分應用本身就和XPOSED模塊衝突</del><span style="text-decoration: line-through;">（例如SE的一大票手游中幾乎大部分的GooglePlay版都有衝突= =）</span>

<hr />

**無法更新OTA的解決辦法（僅限“系統能進就是不能更新”的情況，如果無限重啓，請雙清再重刷系統）**:
> 1\. 查詢當前使用的系統的版本號。
> 2\. 到EMUI官網下載相應的ROM。
> 3\. 將dload拷到SD卡的根目錄。（如插入TF卡，那就是TF卡的根目錄）
> 4\. 通過（"設定"→）"系統更新"→"菜單"→"本地升級" 來“升級”系統。
> 5\. 通過上文的辦法再次Root手機并做好所有“善后工作”。
> 6\. 更新OTA吧。
這種方法的好處是不用雙清，且保留幾乎所有的用戶數據。
另外，這只是一個修復方法，並不是升級的方法。

<hr />

**關於Lucky Patcher (幸運破解器) 、Freedom (一個內購破解工具) 與 OTA**:

幸運破解器的“安卓核心破解”會修改"/system/framework/core.odex"。
而Freedom的“Free core”也會修改"/system/framework/core.odex"
而系統更新（OTA）會檢查SHA1值，“core.odex”是在檢查的範圍内的。

參考資料（recovery_log），注意加粗處
> * * *
> 
> ~
> 
> [2015-02-01 12:55:40 720] int huawei_engine_enter(),line=146:
> Mount external sd card to /sdcard success!
> [2015-02-01 12:55:40 723] char* get_ota_package_path(bootloader_message*),line=680: (replacing path "/HWUserData/HwOUC/update.zip
> " with "/data/share/0/HwOUC/update.zip
> ")
> [2015-02-01 12:55:40 723] int huawei_ota_update(bootloader_message*),line=908: package_path:/data/share/0/HwOUC/update.zip
> [2015-02-01 12:55:40 723] int huawei_ota_update(bootloader_message*),line=909: push HOTA_BEGIN_L0
> 请勿拔掉电池、SD卡及其他任何操作
> [2015-02-01 12:55:41 324] void huawei_ui_print(ui_print_msg_type),line=258: DONOT press powerkey or remove battery!
> 
> [2015-02-01 12:55:41 503] int huawei_do_ota_update(char*, int*),line=874: push HOTA_PRE_L1
> I:ota_pre_update begin
> [2015-02-01 12:55:41 504] int ota_pre_update(const char*),line=501:
> -- Hota update
> I:ota_pre_update end.
> [2015-02-01 12:55:41 504] int huawei_do_ota_update(char*, int*),line=881: pop HOTA_PRE_L1
> [2015-02-01 12:55:41 504] int do_Hota_Update(const char*, int*, const char*),line=806: push HOTA_PROCESS_L1
> [2015-02-01 12:55:41 608] int really_install_package(const char*, int*),line=232: Finding update package...
> I:Update location: /data/share/0/HwOUC/update.zip
> [2015-02-01 12:55:41 608] int really_install_package(const char*, int*),line=245: Opening update package...
> I:read key e=3 hash=20
> I:1 key(s) loaded from /res/keys
> [2015-02-01 12:55:41 609] int really_install_package(const char*, int*),line=256: Verifying update package...
> I:comment is 1755 bytes; signature 1737 bytes from end
> I:whole-file signature verified against key 0
> I:verify_file returned 0
> [2015-02-01 12:55:42 743] int really_install_package(const char*, int*),line=282: Installing update...
> [2015-02-01 12:55:42 743] int try_update_binary(const char*, ZipArchive*, int*),line=57: push HOTA_TRY_BINARY_L2
> [2015-02-01 12:55:42 775] int try_update_binary(const char*, ZipArchive*, int*),line=144: push HOTA_ENTERY_BINARY_L3
> **[2015-02-01 12:55:42 776]** int try_update_binary(const char*, ZipArchive*, int*),line=144: push HOTA_ENTERY_BINARY_L3
> [HW]:int try_update_binary(const char*, ZipArchive*, int*), success to disable the wr_prot
> assert str not terminal
> assert str not terminal
> E:EMUI3.0_H60-L02_5.1.16E:
> E:Thu Jan 8 16:39:37 CST 2015E:
> E:EMUI3.0_H60-L02_5.2.1E:
> E:Wed Jan 28 18:28:16 CST 2015E:
> **E:Verifying current system...E:**
> assert str not terminal
> ~（此處省略若干行"assert str not terminal"）
> assert str not terminal
> **file "/system/framework/core.odex" doesn't have any of expected sha1 sums; checking cache**
> failed to stat "/cache/saved.file": No such file or directory
> failed to load cache file
> assert str terminal
> **script aborted: assert failed: apply_patch_check("/system/framework/core.odex", "39367763f335421ac04523ab02694dce230b5c80", "ff016b4d1880657607afc000684dec5f3cad706a")**
> **[2015-02-01 12:55:53 958] int try_update_binary(const char*, ZipArchive*, int*),line=196: push binary errno 25**
> ** E:assert failed: apply_patch_check("/system/framework/core.odex", "39367763f335421ac04523ab02694dce230b5c80", "ff016b4d1880657607afc000684dec5f3cad706a")**E:
> **E:Error in /data/share/0/HwOUC/update.zip**
> ** (Status 7)**
> **E:Installation failed**
> I:ota_post_update begin
> [2015-02-01 12:55:54 116] int huawei_resize(),line=141: Huawei factory resizing...
> 
> ~
> 
> * * *
報告可在"/splash2/recovery_log"中查看。

所以如果想用幸運破解器的 “安卓核心破解” 功能，同時又想用Freedom，而且想繼續接受并安裝OTA的話，請做好相應的思想工作後再使用。
恢復方法見上文“無法更新OTA的解決辦法”處。

<hr />

（待后续编辑）

<!--草稿部分

> **4.5.**（可選） 如果想要繼續接收OTA更新的話，更新的時候請將Root狀態解除，否則OTA可能會安裝失敗。




-->