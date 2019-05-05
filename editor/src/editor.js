const {ipcRenderer} = require('electron')
const $ = require('./lib/jquery.js')
const fs = require('fs');
const util = require('./util.js')
const crypto = require("crypto");
const child_process = require("child_process")


function setTitle(t) { ipcRenderer.send("title", t) }

window.addEventListener("keydown", (e)=>{onkeydown(e)})
window.addEventListener("input", (e)=>{oninput(e)})

function onkeydown(e) {
  p = true
  if(isPresentation) {
    if(e.key == "ArrowLeft") prev();
    else if(e.key == "ArrowRight") next();
    else if(e.key == "Home") home();
    else if(e.key == 'F5') presentation();
    else if(e.key == "Escape") { edit_mode(true); p = false; }
    else p = false
  } else {
    if(e.key == "PageUp") prev();
    else if(e.key == "PageDown") next();
    else if(e.key == 'F5') presentation();
    else if(e.key == 'X') convertTex2SVG("$\\sum_i^n \\left( \\frac{o+p}{z-d} \\right) \\phi $")
    else p = false
  }

  if(e.code == "KeyS" && e.ctrlKey) save()

  if(p) { e.stopPropagation(); e.preventDefault();}
}

function oninput(e) {
  console.log(e);
  if(e.data === '$') {
    var s = window.getSelection()
    if(s.rangeCount===1) {
      var i = s.anchorNode.wholeText.substr(0,s.anchorOffset-1).lastIndexOf('$')
      if(i!==-1){
        var after = s.anchorNode.splitText(s.anchorOffset)
        convertTexNode2SVG(s.anchorNode.splitText(i), () => {
          window.getSelection().empty()
          var r = document.createRange()
          r.setStartBefore(after); r.collapse()
          window.getSelection().addRange(r)
        })
      }
    }
  }
}

isPresentation = false

function presentation() {
  isPresentation = true
  edit_mode(false)
  var elem = document.body
  if (elem.requestFullscreen) elem.requestFullscreen();
  else if (elem.mozRequestFullScreen) elem.mozRequestFullScreen();
  else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
  else if (elem.msRequestFullscreen) elem.msRequestFullscreen();
}


$(function() { edit_mode(true) })

function edit_mode(b) {
  isPresentation = !b
  $("page, page *").attr("contentEditable", b)
}

function save() {
  edit_mode(false)
  f = document.location.pathname;
  html = $("body").html()
  head = fs.readFileSync(process.cwd() + '/src/head.html', 'utf8')
  html = "<html>" + head + "<body>" + html + "</body></html>"
  fs.writeFile(f, html, (err) => {
    if (err) throw err;
    console.log(f + ' has been saved!');
    edit_mode(true)
  });
}

function convertTex2SVG(tex, cb) {
  fulltex =`
  \\documentclass[preview]{standalone}
  \\usepackage{amsmath}
  \\usepackage{amssymb}
  \\begin{document}
  `+tex+`
  \\end{document}
  `;
  dir = document.location.pathname.replace(".html", "_res")
  fs.mkdirSync(dir, {recursive:true})
  f = crypto.randomBytes(10).toString('hex');
  fs.writeFileSync(dir+"/"+f+".tex", fulltex)

  child_process.exec(process.cwd() + "/tools/latex2svg " + dir+"/"+f+".tex", (err, stdout, stderr) => {
    if(err) { console.log(stderr); return;}
    svg = fs.readFileSync(dir+"/"+f+".svg", "utf-8")
    fs.unlinkSync(dir+"/"+f+".svg")
    // dataURL = "data:image/svg+xml;base64," + window.btoa(svg)
    cb(svg, tex)
  })
}

function convertTexNode2SVG(node, cb) {
  convertTex2SVG(node.data, (svg, tex) => {
    svg = $(svg)
    svg.attr("viewBox", "0 -7 10 9")
    svg.attr("data-tex", tex)
    svg.addClass("latex")
    span = $("<span><img src='o'></span>")
    // span.append(svg)
    $(node).replaceWith(span); cb();
  })
}
