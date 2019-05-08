const {ipcMain, Menu, MenuItem, globalShortcut, app, BrowserWindow, dialog} = require('electron')
const path = require("path")
const fs = require("fs")
let mainWindow

function DBG(msg) {
  dialog.showMessageBox({buttons:['OK'],message:msg.toString()})
}

function createWindow () {
  mainWindow = new BrowserWindow({ width: 800, height: 600, webPreferences: { nodeIntegration: true }})
  mainWindow.on('closed', function () { mainWindow = null })

  mainWindow.webContents.on('devtools-opened', () => {
    mainWindow.webContents.focus();
    setImmediate(function() { mainWindow.webContents.focus(); });
  });
  mainWindow.toggleDevTools()

  open(process.argv[2] || "../1.html")

  mainWindow.maximize()
  Menu.setApplicationMenu(Menu.buildFromTemplate(menu = [
    {label:"File", submenu:[
      {label:"New"},
      {label:"Open"},
      {label:"Save"},
      {label:"Save As"},
      {label:"Export as PDF", accelerator:'Ctrl + E', click() { export_as_pdf() }},
      {label:"Quit"}
    ]}, {label:"Open devtools", accelerator:'F12', click() { mainWindow.toggleDevTools() }},
    {label:"Reload", accelerator:'Ctrl + R', click() { open(process.argv[2] || "../1.html") }}
  ]))
}

app.on('ready', createWindow)
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', function () {
  if (mainWindow === null)   createWindow()
})

ipcMain.on('title', (e,t) => { mainWindow.setTitle(t) })
ipcMain.on('open', (e,f) => { open(f) })

////////////////////////

function getMenuItem(parent, label) {
  for(var i=0; i<parent.length; i++) {
    console.log(parent[i].label + " == " + label)
    if(parent[i].label == label) return parent[i];
    if(parent[i].submenu) {
      m = getMenuItem(parent[i].submenu, label)
      if(m) return m
    }
  }
  return null;
}

function setMenuItem(label, data) {
  m = getMenuItem(menu, label)
  console.log(m)
  if(!m) return
  for(var i in data) m[i] = data[i]
  Menu.setApplicationMenu(Menu.buildFromTemplate(menu))
}

function addMenuItem(parent_label, data) {
  m = getMenuItem(label)
  if(!m) m = menu
  if(!m.submenu) m.submenu = []
  m.submenu.push(data)
  Menu.setApplicationMenu(Menu.buildFromTemplate(menu))
}

////////////////////////


function open(f) {
  if(f[0]!='/') f = process.cwd() + "/"+f
  f = path.normalize(f)
  mainWindow.loadURL("file://" + f)
  mainWindow.setTitle(f)
  filename = f
}

function export_as_pdf() {
  mainWindow.webContents.send("exportpdf-begin")
  mainWindow.webContents.printToPDF({printBackground: true}, (error, data) => {
    if (error) throw error
    fs.writeFile(filename.replace(".html", ".pdf"), data, (error) => {
     if (error) throw error
     mainWindow.webContents.send("exportpdf-end")
    })
  })
}
