using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Input;
using System.Windows.Media;

namespace GleanUninstaller
{
    public class App : Application
    {
        [STAThread]
        public static void Main()
        {
            var app = new App();
            app.ShutdownMode = ShutdownMode.OnMainWindowClose;
            app.Run(new UninstallWindow());
        }
    }

    public class UninstallWindow : Window
    {
        static readonly SolidColorBrush BgDark = new SolidColorBrush(Color.FromRgb(18, 18, 24));
        static readonly SolidColorBrush BgCard = new SolidColorBrush(Color.FromRgb(28, 28, 36));
        static readonly SolidColorBrush Accent = new SolidColorBrush(Color.FromRgb(88, 166, 255));
        static readonly SolidColorBrush TW = new SolidColorBrush(Color.FromRgb(220, 220, 230));
        static readonly SolidColorBrush TM = new SolidColorBrush(Color.FromRgb(130, 130, 150));
        static readonly SolidColorBrush BtnBg = new SolidColorBrush(Color.FromRgb(40, 40, 50));
        static readonly SolidColorBrush BtnHv = new SolidColorBrush(Color.FromRgb(60, 60, 80));
        static readonly SolidColorBrush FarewellGreen = new SolidColorBrush(Color.FromRgb(120, 200, 160));

        StackPanel confirmPage, progressPage, donePage;
        TextBlock statusText, doneText;
        ProgressBar progressBar;
        Button uninstallBtn, cancelBtn, closeBtn;
        string installDir;

        static readonly string[] FilesToRemove = { "glean.exe", "gleanUninstaller.exe" };

        public UninstallWindow()
        {
            // Read install location from registry, fallback to default
            installDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "glean");
            try
            {
                var psi = new ProcessStartInfo("reg", @"query HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Glean /v InstallLocation")
                { RedirectStandardOutput = true, UseShellExecute = false, CreateNoWindow = true };
                var proc = Process.Start(psi);
                string output = proc.StandardOutput.ReadToEnd();
                proc.WaitForExit();
                foreach (string line in output.Split('\n'))
                {
                    if (line.Contains("InstallLocation"))
                    {
                        string[] parts = line.Trim().Split(new char[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                        if (parts.Length >= 3)
                        {
                            string path = parts[parts.Length - 1].Trim().TrimEnd('\r');
                            if (Directory.Exists(path))
                                installDir = path;
                        }
                    }
                }
            }
            catch { }

            Title = "Glean Uninstaller";
            Width = 460; Height = 340;
            WindowStartupLocation = WindowStartupLocation.CenterScreen;
            WindowStyle = WindowStyle.None;
            ResizeMode = ResizeMode.NoResize;
            Background = BgDark;
            FontFamily = new FontFamily("Segoe UI");
            Foreground = TW;

            KeyDown += (s, e) => { if (e.Key == Key.Escape) Close(); };
            MouseLeftButtonDown += (s, e) => { if (e.LeftButton == MouseButtonState.Pressed) DragMove(); };

            var root = new DockPanel();

            // Button bar
            var btnBar = new Border { Background = BgCard, Height = 50 };
            var btnGrid = new Grid();
            btnGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Auto) });
            btnGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            btnGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Auto) });
            btnGrid.Margin = new Thickness(12, 8, 12, 8);

            cancelBtn = MakeBtn("Cancel", false, (s, e) => Close());
            Grid.SetColumn(cancelBtn, 0);
            btnGrid.Children.Add(cancelBtn);

            var spacer = new Border();
            Grid.SetColumn(spacer, 1);
            btnGrid.Children.Add(spacer);

            uninstallBtn = MakeBtn("Uninstall", true, (s, e) => ShowProgress());
            uninstallBtn.Background = new SolidColorBrush(Color.FromRgb(180, 60, 60));
            Grid.SetColumn(uninstallBtn, 2);
            btnGrid.Children.Add(uninstallBtn);

            closeBtn = MakeBtn("Close", true, (s, e) => Close());
            closeBtn.Visibility = Visibility.Collapsed;
            Grid.SetColumn(closeBtn, 2);
            btnGrid.Children.Add(closeBtn);

            btnBar.Child = btnGrid;
            DockPanel.SetDock(btnBar, Dock.Bottom);
            root.Children.Add(btnBar);

            var sep = new Border { Height = 1, Background = new SolidColorBrush(Color.FromRgb(40, 40, 52)) };
            DockPanel.SetDock(sep, Dock.Bottom);
            root.Children.Add(sep);

            // Pages
            var pageGrid = new Grid();
            confirmPage = BuildConfirmPage();
            progressPage = BuildProgressPage();
            donePage = BuildDonePage();
            pageGrid.Children.Add(confirmPage);
            pageGrid.Children.Add(progressPage);
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
            template.Triggers.Add(triggerDisabled);

            btn.Template = template;
            btn.MouseEnter += (s, e) => { if (btn.IsEnabled) btn.Background = accent ? Accent : BtnHv; };
            btn.MouseLeave += (s, e) => { if (btn.IsEnabled) btn.Background = accent ? Accent : BtnBg; };
            btn.Click += click;

            return btn;
        }

        StackPanel BuildConfirmPage()
        {
            var p = new StackPanel { Background = BgDark, VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(50, 0, 50, 20) };
            p.Children.Add(new TextBlock
            {
                Text = "Uninstall Glean?",
                Foreground = TW,
                FontSize = 20,
                FontWeight = FontWeights.SemiBold,
                HorizontalAlignment = HorizontalAlignment.Center,
                Margin = new Thickness(0, 0, 0, 16)
            });
            p.Children.Add(new TextBlock
            {
                Text = "This will remove Glean and all its files from:",
                Foreground = TM,
                FontSize = 11,
                HorizontalAlignment = HorizontalAlignment.Center,
                Margin = new Thickness(0, 0, 0, 8)
            });
            p.Children.Add(new TextBlock
            {
                Text = installDir,
                Foreground = Accent,
                FontSize = 10,
                HorizontalAlignment = HorizontalAlignment.Center,
                TextWrapping = TextWrapping.Wrap,
                Margin = new Thickness(0, 0, 0, 16)
            });
            p.Children.Add(new TextBlock
            {
                Text = "Your notes and settings will not be affected.",
                Foreground = TM,
                FontSize = 10,
                HorizontalAlignment = HorizontalAlignment.Center,
            });
            return p;
        }

        StackPanel BuildProgressPage()
        {
            var p = new StackPanel { Background = BgDark, Margin = new Thickness(50, 50, 50, 10) };
            p.Children.Add(new TextBlock
            {
                Text = "Uninstalling...",
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
                Foreground = new SolidColorBrush(Color.FromRgb(180, 60, 60)),
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
            var p = new StackPanel { Background = BgDark, VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(50, 0, 50, 20) };
            p.Children.Add(new TextBlock
            {
                Text = "Goodbye",
                Foreground = FarewellGreen,
                FontSize = 24,
                FontWeight = FontWeights.SemiBold,
                HorizontalAlignment = HorizontalAlignment.Center,
                Margin = new Thickness(0, 0, 0, 16)
            });

            doneText = new TextBlock
            {
                Text = "",
                Foreground = TM,
                FontSize = 11,
                TextAlignment = TextAlignment.Center,
                TextWrapping = TextWrapping.Wrap,
            };
            p.Children.Add(doneText);

            return p;
        }

        void ShowPage(int idx)
        {
            confirmPage.Visibility = idx == 0 ? Visibility.Visible : Visibility.Collapsed;
            progressPage.Visibility = idx == 1 ? Visibility.Visible : Visibility.Collapsed;
            donePage.Visibility = idx == 2 ? Visibility.Visible : Visibility.Collapsed;
        }

        void ShowProgress()
        {
            uninstallBtn.IsEnabled = false;
            cancelBtn.IsEnabled = false;
            ShowPage(1);
            RunUninstall();
        }

        void RunUninstall()
        {
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

                update(10, "Closing Glean...");
                System.Threading.Thread.Sleep(200);

                try
                {
                    foreach (var proc in Process.GetProcessesByName("glean"))
                    {
                        try { proc.Kill(); proc.WaitForExit(3000); } catch { }
                    }
                }
                catch { }
                System.Threading.Thread.Sleep(500);

                update(30, "Removing files...");
                System.Threading.Thread.Sleep(200);

                foreach (string file in FilesToRemove)
                {
                    try
                    {
                        string path = Path.Combine(installDir, file);
                        if (File.Exists(path))
                            File.Delete(path);
                    }
                    catch { }
                }

                update(50, "Removing Start Menu shortcut...");
                System.Threading.Thread.Sleep(200);

                try
                {
                    string sm = Path.Combine(
                        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                        "Microsoft", "Windows", "Start Menu", "Programs", "Glean");
                    if (Directory.Exists(sm))
                        Directory.Delete(sm, true);
                }
                catch { }

                update(70, "Removing registry entries...");
                System.Threading.Thread.Sleep(200);

                try
                {
                    RunRegDelete(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Glean");
                }
                catch { }

                update(85, "Cleaning up...");
                System.Threading.Thread.Sleep(200);

                // Spawn a batch script to delete the uninstaller and folder after we exit
                try
                {
                    string batPath = Path.Combine(Path.GetTempPath(), "glean_cleanup.bat");
                    string dirToDelete = installDir;
                    string batContent =
                        "@echo off\r\n" +
                        "ping 127.0.0.1 -n 3 > nul\r\n" +
                        "del \"" + Path.Combine(dirToDelete, "gleanUninstaller.exe") + "\"\r\n" +
                        "rmdir \"" + dirToDelete + "\" 2>nul\r\n" +
                        "del \"" + batPath + "\"\r\n";
                    File.WriteAllText(batPath, batContent);
                    var psi = new ProcessStartInfo("cmd", "/c \"" + batPath + "\"")
                    {
                        UseShellExecute = false,
                        CreateNoWindow = true,
                        WindowStyle = ProcessWindowStyle.Hidden
                    };
                    Process.Start(psi);
                }
                catch { }

                System.Threading.Thread.Sleep(300);

                update(100, "Done!");
                Dispatcher.Invoke(() =>
                {
                    var farewellMessages = new string[]
                    {
                        "Thanks for trying Glean.\nWe hope to see you again.",
                        "All clean. Your desktop is yours again.",
                        "No leftovers, no mess.\nCome back anytime.",
                        "Thanks for giving it a shot.\nYour notes and settings are untouched.",
                        "Everything removed.\nYou're all set.",
                    };
                    var rng = new Random();
                    doneText.Text = farewellMessages[rng.Next(farewellMessages.Length)];
                    doneText.Foreground = FarewellGreen;

                    ShowPage(2);
                    uninstallBtn.Visibility = Visibility.Collapsed;
                    cancelBtn.Visibility = Visibility.Collapsed;
                    closeBtn.Visibility = Visibility.Visible;
                });
            });
            t.IsBackground = true;
            t.Start();
        }

        void RunRegDelete(string key)
        {
            var psi = new ProcessStartInfo("reg", "delete \"" + key + "\" /f")
            { UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden };
            Process.Start(psi).WaitForExit();
        }
    }
}
