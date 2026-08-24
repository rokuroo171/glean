using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Input;
using System.Windows.Media;

namespace GleanInstaller
{
    public class App : Application
    {
        [STAThread]
        public static void Main()
        {
            var app = new App();
            app.ShutdownMode = ShutdownMode.OnMainWindowClose;
            app.Run(new InstallerWindow());
        }
    }

    public class InstallerWindow : Window
    {
        static readonly SolidColorBrush BgDark = new SolidColorBrush(Color.FromRgb(18, 18, 24));
        static readonly SolidColorBrush BgCard = new SolidColorBrush(Color.FromRgb(28, 28, 36));
        static readonly SolidColorBrush Accent = new SolidColorBrush(Color.FromRgb(88, 166, 255));
        static readonly SolidColorBrush TW = new SolidColorBrush(Color.FromRgb(220, 220, 230));
        static readonly SolidColorBrush TM = new SolidColorBrush(Color.FromRgb(130, 130, 150));
        static readonly SolidColorBrush BtnBg = new SolidColorBrush(Color.FromRgb(40, 40, 50));
        static readonly SolidColorBrush BtnHv = new SolidColorBrush(Color.FromRgb(60, 60, 80));
        static readonly SolidColorBrush BtnDis = new SolidColorBrush(Color.FromRgb(30, 30, 38));
        static readonly SolidColorBrush InputBg = new SolidColorBrush(Color.FromRgb(32, 32, 42));
        static readonly SolidColorBrush InputBorder = new SolidColorBrush(Color.FromRgb(55, 55, 70));

        StackPanel welcomePage, dirPage, installPage, donePage;
        TextBlock statusText, doneText;
        CheckBox launchCheck, desktopCheck;
        Button backBtn, nextBtn, cancelBtn;
        ProgressBar progressBar;
        TextBox dirBox;
        string installDir, srcDir;
        int currentPage = 0;
        bool createDesktopShortcut = false;

        public InstallerWindow()
        {
            srcDir = Path.GetDirectoryName(Process.GetCurrentProcess().MainModule.FileName);
            installDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "glean");

            Title = "Glean Installer";
            Width = 460; Height = 380;
            WindowStartupLocation = WindowStartupLocation.CenterScreen;
            WindowStyle = WindowStyle.None;
            ResizeMode = ResizeMode.NoResize;
            Background = BgDark;
            FontFamily = new FontFamily("Segoe UI");
            Foreground = TW;

            KeyDown += (s, e) => { if (e.Key == Key.Escape) Close(); };
            MouseLeftButtonDown += (s, e) => { if (e.LeftButton == MouseButtonState.Pressed) DragMove(); };

            var root = new DockPanel();

            // Button bar at bottom
            var btnBar = new Border { Background = BgCard, Height = 50 };
            var btnGrid = new Grid();
            btnGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Auto) });
            btnGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            btnGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Auto) });
            btnGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Auto) });
            btnGrid.Margin = new Thickness(12, 8, 12, 8);

            cancelBtn = MakeBtn("Cancel", false, (s, e) => Close());
            Grid.SetColumn(cancelBtn, 0);
            btnGrid.Children.Add(cancelBtn);

            backBtn = MakeBtn("< Back", false, (s, e) => Navigate(-1));
            backBtn.IsEnabled = false;
            Grid.SetColumn(backBtn, 2);
            btnGrid.Children.Add(backBtn);

            nextBtn = MakeBtn("Next >", true, (s, e) => Navigate(1));
            Grid.SetColumn(nextBtn, 3);
            btnGrid.Children.Add(nextBtn);

            btnBar.Child = btnGrid;
            DockPanel.SetDock(btnBar, Dock.Bottom);
            root.Children.Add(btnBar);

            var sep = new Border { Height = 1, Background = new SolidColorBrush(Color.FromRgb(40, 40, 52)) };
            DockPanel.SetDock(sep, Dock.Bottom);
            root.Children.Add(sep);

            // Pages
            var pageGrid = new Grid();
            welcomePage = BuildWelcomePage();
            dirPage = BuildDirPage();
            installPage = BuildInstallPage();
            donePage = BuildDonePage();
            pageGrid.Children.Add(welcomePage);
            pageGrid.Children.Add(dirPage);
            pageGrid.Children.Add(installPage);
            pageGrid.Children.Add(donePage);
            root.Children.Add(pageGrid);

            Content = root;
            ShowPage(0);
        }

        Button MakeBtn(string text, bool accent, RoutedEventHandler click)
        {
            var btn = new Button
            {
                Content = text,
                Foreground = TW,
                Background = accent ? Accent : BtnBg,
                FontSize = 12,
                FontFamily = new FontFamily("Segoe UI"),
                Padding = new Thickness(16, 6, 16, 6),
                Margin = new Thickness(4, 0, 4, 0),
                Cursor = Cursors.Hand,
                BorderThickness = new Thickness(0),
                MinWidth = 80,
                Height = 30,
                HorizontalContentAlignment = HorizontalAlignment.Center,
            };

            var template = new ControlTemplate(typeof(Button));
            var border = new FrameworkElementFactory(typeof(Border));
            border.Name = "bd";
            border.SetBinding(Border.BackgroundProperty, new Binding("Background") { RelativeSource = new RelativeSource(RelativeSourceMode.TemplatedParent) });
            border.SetValue(Border.CornerRadiusProperty, new CornerRadius(16));
            border.SetValue(Border.PaddingProperty, new Thickness(16, 6, 16, 6));
            border.SetValue(Border.BorderThicknessProperty, new Thickness(0));
            var cp = new FrameworkElementFactory(typeof(ContentPresenter));
            cp.SetValue(ContentPresenter.HorizontalAlignmentProperty, HorizontalAlignment.Center);
            cp.SetValue(ContentPresenter.VerticalAlignmentProperty, VerticalAlignment.Center);
            border.AppendChild(cp);
            template.VisualTree = border;

            var triggerDisabled = new Trigger { Property = Button.IsEnabledProperty, Value = false };
            triggerDisabled.Setters.Add(new Setter(Control.ForegroundProperty, TM, "bd"));
            triggerDisabled.Setters.Add(new Setter(Control.BackgroundProperty, BtnDis, "bd"));
            template.Triggers.Add(triggerDisabled);

            btn.Template = template;
            btn.MouseEnter += (s, e) => { if (btn.IsEnabled) btn.Background = accent ? Accent : BtnHv; };
            btn.MouseLeave += (s, e) => { if (btn.IsEnabled) btn.Background = accent ? Accent : BtnBg; };
            btn.Click += click;

            return btn;
        }

        StackPanel BuildWelcomePage()
        {
            var p = new StackPanel { Background = BgDark, VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(50, 0, 50, 40) };
            p.Children.Add(new TextBlock
            {
                Text = "Glean",
                Foreground = Accent,
                FontSize = 36,
                FontWeight = FontWeights.Bold,
                HorizontalAlignment = HorizontalAlignment.Center,
                Margin = new Thickness(0, 0, 0, 12)
            });
            p.Children.Add(new TextBlock
            {
                Text = "A note-taking app with lots of customization",
                Foreground = TM,
                FontSize = 12,
                HorizontalAlignment = HorizontalAlignment.Center,
                Margin = new Thickness(0, 0, 0, 6)
            });
            p.Children.Add(new TextBlock
            {
                Text = "v1.3.2",
                Foreground = TM,
                FontSize = 10,
                HorizontalAlignment = HorizontalAlignment.Center
            });
            return p;
        }

        StackPanel BuildDirPage()
        {
            var p = new StackPanel { Background = BgDark, Margin = new Thickness(50, 30, 50, 10) };
            p.Children.Add(new TextBlock
            {
                Text = "Choose Install Location",
                Foreground = TW,
                FontSize = 16,
                FontWeight = FontWeights.SemiBold,
                Margin = new Thickness(0, 0, 0, 16)
            });
            p.Children.Add(new TextBlock
            {
                Text = "Glean will be installed to:",
                Foreground = TM,
                FontSize = 11,
                Margin = new Thickness(0, 0, 0, 8)
            });

            var pathRow = new Grid { Margin = new Thickness(0, 0, 0, 12) };
            pathRow.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            pathRow.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Auto) });

            dirBox = new TextBox
            {
                Text = installDir,
                Background = InputBg,
                Foreground = TW,
                BorderBrush = InputBorder,
                BorderThickness = new Thickness(1),
                FontSize = 11,
                FontFamily = new FontFamily("Segoe UI"),
                Padding = new Thickness(8, 5, 8, 5),
                VerticalContentAlignment = VerticalAlignment.Center,
                IsReadOnly = true
            };
            Grid.SetColumn(dirBox, 0);
            pathRow.Children.Add(dirBox);

            var browseBtn = MakeBtn("Browse...", false, (s, e) =>
            {
                var dlg = new System.Windows.Forms.FolderBrowserDialog
                {
                    Description = "Select installation folder",
                    SelectedPath = installDir,
                    ShowNewFolderButton = true
                };
                if (dlg.ShowDialog() == System.Windows.Forms.DialogResult.OK)
                {
                    installDir = dlg.SelectedPath;
                    dirBox.Text = installDir;
                }
            });
            browseBtn.MinWidth = 90;
            browseBtn.Margin = new Thickness(8, 0, 0, 0);
            Grid.SetColumn(browseBtn, 1);
            pathRow.Children.Add(browseBtn);

            p.Children.Add(pathRow);

            p.Children.Add(new TextBlock
            {
                Text = "Requires approximately 12 MB of disk space.",
                Foreground = TM,
                FontSize = 10,
                Margin = new Thickness(0, 8, 0, 0)
            });

            desktopCheck = new CheckBox
            {
                Content = "Create Desktop shortcut",
                Foreground = TM,
                FontSize = 10,
                IsChecked = false,
                Margin = new Thickness(0, 8, 0, 0)
            };
            p.Children.Add(desktopCheck);

            return p;
        }

        StackPanel BuildInstallPage()
        {
            var p = new StackPanel { Background = BgDark, Margin = new Thickness(50, 50, 50, 10) };
            p.Children.Add(new TextBlock
            {
                Text = "Installing...",
                Foreground = TW,
                FontSize = 16,
                FontWeight = FontWeights.SemiBold,
                Margin = new Thickness(0, 0, 0, 20)
            });

            progressBar = new ProgressBar
            {
                Minimum = 0,
                Maximum = 100,
                Height = 6,
                Background = new SolidColorBrush(Color.FromRgb(35, 35, 45)),
                Foreground = Accent,
                BorderThickness = new Thickness(0)
            };
            var pbXaml = "<ControlTemplate xmlns='http://schemas.microsoft.com/winfx/2006/xaml/presentation' xmlns:x='http://schemas.microsoft.com/winfx/2006/xaml' TargetType='{x:Type ProgressBar}'><Border Background='{TemplateBinding Background}' CornerRadius='3' ClipToBounds='True'><Border x:Name='PART_Indicator' Background='{TemplateBinding Foreground}' CornerRadius='3' HorizontalAlignment='Left'/></Border></ControlTemplate>";
            progressBar.Template = (ControlTemplate)System.Windows.Markup.XamlReader.Parse(pbXaml);
            p.Children.Add(progressBar);

            statusText = new TextBlock
            {
                Text = "Preparing...",
                Foreground = TM,
                FontSize = 10,
                HorizontalAlignment = HorizontalAlignment.Center,
                Margin = new Thickness(0, 12, 0, 0)
            };
            p.Children.Add(statusText);

            return p;
        }

        StackPanel BuildDonePage()
        {
            var p = new StackPanel { Background = BgDark, Margin = new Thickness(50, 40, 50, 10) };
            p.Children.Add(new TextBlock
            {
                Text = "Installation Complete",
                Foreground = TW,
                FontSize = 16,
                FontWeight = FontWeights.SemiBold,
                Margin = new Thickness(0, 0, 0, 20)
            });

            doneText = new TextBlock
            {
                Text = "",
                Foreground = TM,
                FontSize = 11,
                TextAlignment = TextAlignment.Center,
                TextWrapping = TextWrapping.Wrap,
                Margin = new Thickness(0, 0, 0, 16)
            };
            p.Children.Add(doneText);

            launchCheck = new CheckBox
            {
                Content = "Launch Glean",
                Foreground = TW,
                FontSize = 11,
                IsChecked = true,
                HorizontalAlignment = HorizontalAlignment.Center,
            };
            p.Children.Add(launchCheck);

            return p;
        }

        void ShowPage(int idx)
        {
            currentPage = idx;
            welcomePage.Visibility = idx == 0 ? Visibility.Visible : Visibility.Collapsed;
            dirPage.Visibility = idx == 1 ? Visibility.Visible : Visibility.Collapsed;
            installPage.Visibility = idx == 2 ? Visibility.Visible : Visibility.Collapsed;
            donePage.Visibility = idx == 3 ? Visibility.Visible : Visibility.Collapsed;

            switch (idx)
            {
                case 0:
                    backBtn.IsEnabled = false;
                    nextBtn.IsEnabled = true;
                    nextBtn.Content = "Next >";
                    nextBtn.Background = Accent;
                    break;
                case 1:
                    backBtn.IsEnabled = true;
                    nextBtn.IsEnabled = true;
                    nextBtn.Content = "Install";
                    nextBtn.Background = Accent;
                    break;
                case 2:
                    backBtn.IsEnabled = false;
                    nextBtn.IsEnabled = false;
                    cancelBtn.IsEnabled = false;
                    Install();
                    break;
                case 3:
                    backBtn.IsEnabled = false;
                    nextBtn.IsEnabled = true;
                    nextBtn.Content = "Close";
                    nextBtn.Background = Accent;
                    cancelBtn.IsEnabled = false;
                    break;
            }
        }

        void Navigate(int dir)
        {
            if (dir > 0)
            {
                if (currentPage == 0)
                    ShowPage(1);
                else if (currentPage == 1)
                    ShowPage(2);
                else if (currentPage == 3)
                {
                    // Launch glean if checkbox is checked
                    if (launchCheck.IsChecked == true)
                    {
                        try { Process.Start(Path.Combine(installDir, "glean.exe")); } catch { }
                    }
                    Close();
                }
            }
            else
            {
                if (currentPage == 1)
                    ShowPage(0);
            }
        }

        void Install()
        {
            createDesktopShortcut = desktopCheck.IsChecked == true;

            foreach (var child in installPage.Children)
            {
                if (child is TextBlock)
                {
                    TextBlock tb = (TextBlock)child;
                    if (tb.FontSize == 16)
                        tb.Text = "Installing...";
                }
            }

            var t = new System.Threading.Thread(() =>
            {
                Action<int, string> update = (pct, msg) =>
                {
                    Dispatcher.Invoke(() =>
                    {
                        progressBar.Value = pct;
                        statusText.Text = msg;
                    });
                };

                update(5, "Checking WebView2...");
                bool hasWV = false;
                try
                {
                    var psi = new ProcessStartInfo("reg", @"query HKLM\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BEE-13A6279EDD22} /v pv")
                    { RedirectStandardOutput = true, UseShellExecute = false, CreateNoWindow = true };
                    var proc = Process.Start(psi);
                    string output = proc.StandardOutput.ReadToEnd();
                    proc.WaitForExit();
                    hasWV = output.Contains("pv");
                }
                catch { }

                update(15, "Copying files...");
                System.Threading.Thread.Sleep(200);
                try { Directory.CreateDirectory(installDir); } catch { }

                ExtractFile("glean.exe", "glean.exe", installDir);
                update(40, "Copying glean.exe...");
                System.Threading.Thread.Sleep(200);

                ExtractFile("gleanUninstaller.exe", "gleanUninstaller.exe", installDir);
                update(55, "Copying uninstaller...");
                System.Threading.Thread.Sleep(200);

                update(65, "Creating Start Menu shortcut...");
                try
                {
                    string smDir = Path.Combine(
                        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                        "Microsoft", "Windows", "Start Menu", "Programs", "Glean");
                    Directory.CreateDirectory(smDir);
                    string exePath = Path.Combine(installDir, "glean.exe");
                    CreateShortcut(Path.Combine(smDir, "Glean.lnk"), exePath, exePath, "Glean - note-taking app");
                }
                catch { }
                System.Threading.Thread.Sleep(200);

                if (createDesktopShortcut)
                {
                    update(68, "Creating Desktop shortcut...");
                    try
                    {
                        string desktopDir = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
                        string exePath = Path.Combine(installDir, "glean.exe");
                        CreateShortcut(Path.Combine(desktopDir, "Glean.lnk"), exePath, exePath, "Glean - note-taking app");
                    }
                    catch { }
                    System.Threading.Thread.Sleep(200);
                }

                update(80, "Writing registry entries...");
                try
                {
                    string key = @"HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Glean";
                    string uninstallerPath = Path.Combine(installDir, "gleanUninstaller.exe");
                    string iconPath = Path.Combine(installDir, "glean.exe");
                    RunReg(key, "DisplayName", "Glean");
                    RunReg(key, "DisplayVersion", "1.3.2");
                    RunReg(key, "Publisher", "rokuroo171");
                    RunReg(key, "InstallLocation", installDir);
                    RunReg(key, "UninstallString", "\"" + uninstallerPath + "\"");
                    RunReg(key, "DisplayIcon", "\"" + iconPath + "\"");
                    RunReg(key, "NoModify", "1");
                    RunReg(key, "NoRepair", "1");
                }
                catch { }
                System.Threading.Thread.Sleep(200);

                update(100, "Done!");
                Dispatcher.Invoke(() =>
                {
                    doneText.Text = "Glean has been installed to:\n" + installDir;
                    if (!hasWV)
                        doneText.Text += "\n\nNote: WebView2 Runtime is required. Download from microsoft.com if the app doesn't start.";
                    ShowPage(3);
                });
            });
            t.IsBackground = true;
            t.Start();
        }

        // Extract an embedded resource for self-contained installs, falling
        // back to a file next to the installer for local dev builds.
        void ExtractFile(string name, string fileName, string destDir)
        {
            string dst = Path.Combine(destDir, fileName);
            try
            {
                var asm = System.Reflection.Assembly.GetExecutingAssembly();
                using (var rs = asm.GetManifestResourceStream(name))
                {
                    if (rs != null)
                    {
                        using (var fs = File.Create(dst))
                            rs.CopyTo(fs);
                        return;
                    }
                }
            }
            catch { }
            try
            {
                string src = Path.Combine(srcDir, fileName);
                if (!File.Exists(src))
                    src = Path.Combine(srcDir, "..", fileName);
                if (File.Exists(src))
                    File.Copy(src, dst, true);
            }
            catch { }
        }

        void RunReg(string key, string name, string value)
        {
            var psi = new ProcessStartInfo("reg", "add \"" + key + "\" /v \"" + name + "\" /t REG_SZ /d \"" + value + "\" /f")
            { UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden };
            Process.Start(psi).WaitForExit();
        }

        // COM interop for .lnk shortcuts
        [ComImport, Guid("00021401-0000-0000-C000-000000000046")]
        class ShellLink { }

        [ComImport, Guid("000214F9-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        interface IShellLinkW
        {
            void GetPath([Out, MarshalAs(UnmanagedType.LPWStr)] System.Text.StringBuilder pszFile, int cch, IntPtr pfd, uint fFlags);
            void GetIDList(out IntPtr ppidl);
            void SetIDList(IntPtr pidl);
            void GetDescription([Out, MarshalAs(UnmanagedType.LPWStr)] System.Text.StringBuilder pszName, int cch);
            void SetDescription([MarshalAs(UnmanagedType.LPWStr)] string pszName);
            void GetWorkingDirectory([Out, MarshalAs(UnmanagedType.LPWStr)] System.Text.StringBuilder pszDir, int cch);
            void SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string pszDir);
            void GetArguments([Out, MarshalAs(UnmanagedType.LPWStr)] System.Text.StringBuilder pszArgs, int cch);
            void SetArguments([MarshalAs(UnmanagedType.LPWStr)] string pszArgs);
            void GetHotkey(out short pwHotkey);
            void SetHotkey(short wHotkey);
            void GetShowCmd(out int piShowCmd);
            void SetShowCmd(int iShowCmd);
            void GetIconLocation([Out, MarshalAs(UnmanagedType.LPWStr)] System.Text.StringBuilder pszIconPath, int cch, out int piIcon);
            void SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string pszIconPath, int iIcon);
            void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string pszPathRel, uint dwReserved);
            void Resolve(IntPtr hwnd, uint fFlags);
            void SetPath([MarshalAs(UnmanagedType.LPWStr)] string pszFile);
        }

        [ComImport, Guid("0000010b-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        interface IPersistFile
        {
            void GetCurFile(out IntPtr ppszFileName);
            void IsDirty();
            void Load([MarshalAs(UnmanagedType.LPWStr)] string pszFileName, int dwMode);
            void Save([MarshalAs(UnmanagedType.LPWStr)] string pszFileName, [MarshalAs(UnmanagedType.Bool)] bool fRemember);
            void SaveCompleted([MarshalAs(UnmanagedType.LPWStr)] string pszFileName);
        }

        void CreateShortcut(string lnkPath, string targetPath, string iconPath, string description)
        {
            var shellLink = (IShellLinkW)new ShellLink();
            shellLink.SetPath(targetPath);
            shellLink.SetDescription(description);
            shellLink.SetWorkingDirectory(Path.GetDirectoryName(targetPath));
            if (iconPath != null && File.Exists(iconPath))
                shellLink.SetIconLocation(iconPath, 0);
            var persistFile = (IPersistFile)shellLink;
            persistFile.Save(lnkPath, true);
            Marshal.ReleaseComObject(shellLink);
        }
    }
}
