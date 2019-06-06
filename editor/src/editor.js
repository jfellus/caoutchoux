const {ipcRenderer} = require('electron')
const $ = require('./lib/jquery.js')
const fs = require('fs');
const util = require('./util.js')
const crypto = require("crypto");
const child_process = require("child_process")
const ace = require('./lib/ace/ace.js')
const app = require('electron').remote.app

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
    else if(e.key == 'Enter') p = on_newline(window.getSelection());
    else p = false
  }

  if(e.code == "KeyS" && e.ctrlKey) save()

  if(p) { e.stopPropagation(); e.preventDefault(); }
  return p;
}

var lastinput = null;
function oninput(e) {
  if(e.data === '$' && lastinput === '$') on_input_latex(window.getSelection(), true)
  else if(e.data === '$') on_input_latex(window.getSelection(), false)
  if(e.data === '`') on_input_code(window.getSelection())
  lastinput = e.data
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

function setTitle(t) { ipcRenderer.send("title", t) }

function edit_mode(b) {
  isPresentation = !b
  $("page, page *").attr("contentEditable", b ? true : null)
  $("svg").each(function(){
    $(this).attr("contenteditable", null)
    $(this).find("*").attr("contentEditable", null)
    $(this).find("*").attr("contenteditable", null)
  })
}
$(function() { edit_mode(true) })

function save() {
  edit_mode(false)
  f = document.location.pathname;
  doc = $("body").clone()
  doc.find(".toolbar").remove()
  doc.find(".latex_editor").remove()
  doc.find("pre.ace_editor").each(function() {
    $(this).replaceWith("<pre>" + ace_editors[parseInt($(this).attr("ace-editor-id"))].getValue() + "</pre>")
  })
  html = doc.html()
  head = fs.readFileSync(app.getAppPath() + '/src/head.html', 'utf8')
  html = "<html>" + head + "<body>" + html + "</body></html>"
  fs.writeFile(f, html, (err) => {
    if (err) throw err;
    console.log(f + ' has been saved!');
    edit_mode(true)
  });
}

function convertTex2SVG(tex, isEq, cb) {
  var fulltex =`
  \\documentclass[preview]{standalone}
  \\usepackage{amsmath}
  \\usepackage{amssymb}
  \\begin{document}
  `+tex+`
  \\end{document}
  `;
  if(isEq) {
    fulltex = `
    \\documentclass[preview]{standalone}
    \\usepackage{amsmath}
    \\usepackage{amssymb}
    \\begin{document}
    \\begin{equation*}
    `+ tex.substr(2, tex.length-4) +`
    \\end{equation*}
    \\end{document}
    `;
  }

  var dir = document.location.pathname.replace(".html", "_res")
  fs.mkdirSync(dir, {recursive:true})
  var f = crypto.randomBytes(10).toString('hex');
  fs.writeFileSync(dir+"/"+f+".tex", fulltex)

  child_process.exec(app.getAppPath() + "/tools/latex2svg " + dir+"/"+f+".tex", (err, stdout, stderr) => {
    if(err) { console.log(stderr); return;}
    try {
      var svg = fs.readFileSync(dir+"/"+f+".svg", "utf-8")
      fs.unlinkSync(dir+"/"+f+".svg")
      cb(svg, tex)
    } catch(e) {
      cb(null, tex)
    }
    // dataURL = "data:image/svg+xml;base64," + window.btoa(svg)
  })
}

function convertTex2SVG_elt(tex, isEq, cb) {
  convertTex2SVG(tex, isEq, (svg, tex) => {
    if(!svg) return cb(null)
    svg = $(svg)
    if(svg.length === 5) svg = $(svg[svg.length-1])
    var offset = -.1
    if(tex.indexOf("\\")===-1) {
      var hasH = (new RegExp("[bdhiklt]")).test(tex)
      var hasL = (new RegExp("[gpqy]")).test(tex)
      if(hasH && !hasL) offset = -.43
      else if(!hasH && hasL) offset = .12
    }
    h = parseFloat(svg.attr("height"))
    w = parseFloat(svg.attr("width"))
    svg.css("margin-top", offset + "em")
    svg.attr("height", (h*.13) + "em")
    svg.attr("width", null)
    svg.attr("data-tex", tex)
    svg.addClass("latex")
    svg.click(function(){open_latex_editor(this)})
    cb(svg)
  })
}


function convertTexNode2SVG_wrap(node, isEq, cb) {
    convertTex2SVG_elt(node.data, isEq, (svg) => {
      if(!svg) return cb(null)
      var span = $("<span class='latex "+ (isEq ? "equation" : "") +"'><img class='svg-dummy-boundaries'></img></span>")
      span.append(svg);
      span.append("<img class='svg-dummy-boundaries'></img>")
      if(isEq) span.append("<span class='equation-nb'></span>")
      $(node).replaceWith(span);
      if(isEq) span.after("<p>&nbsp;</p>")
      $(".latex .equation-nb").each(function(i) { $(this).html("("+(i+1)+")")})
      cb(svg);
    })
}

//////////////////////

$(function(){
  toolbar = $("<div class='toolbar'></div>")
  toolbar.append($("<button>Add block</button>").on("click", ()=>{ add_block() }))
  toolbar.append($("<button>Add slide</button>").on("click", ()=>{ add_slide() }))
  $("body").append(toolbar)

  // Latex editor
  latex_editor = $("<pre class='latex_editor'></pre>")
  $("body").append(latex_editor)
  ace_latex_editor = ace.edit(latex_editor[0]);
  ace_latex_editor.session.setMode("ace/mode/" + "latex");
  ace_latex_editor.setTheme("ace/theme/tomorrow");
  // ace_latex_editor.setAutoScrollEditorIntoView(true);
  ace_latex_editor.setOption("maxLines", 1000);
  ace_latex_editor.setOption("fontSize", "20pt");
  $(".latex_editor").hide()
  $("svg.latex").click(function(){open_latex_editor(this)})
  ace_latex_editor.on("blur", () => { $(".latex_editor").hide(); ace_latex_editor._cur_edited_elt = null})
  $(".latex_editor").keydown((e)=> { if(e.key === "Escape") ace_latex_editor.blur() })
  $(".latex_editor").keyup((e)=> { update_latex_editor() })
})

function open_latex_editor(e) {
    $(".latex_editor").show()
    ace_latex_editor.setValue(e.getAttribute("data-tex"), 1)
    ace_latex_editor._cur_edited_elt = e.parentNode
    ace_latex_editor.focus()
}

function update_latex_editor() {
  if(!ace_latex_editor._cur_edited_elt) return
  var isEq = ace_latex_editor.getValue().indexOf('$$')===0
  convertTex2SVG_elt(ace_latex_editor.getValue(), isEq, (svg) => {
    if(!svg) return;
    $(ace_latex_editor._cur_edited_elt).children("svg").replaceWith(svg)
  })
}

function add_block() {
  $("page[cur]").append("<div class='block'><h2>Title</h2><p>content</p></div>")
}

function add_slide() {
  $("body").append("<page><h1>Title</h1><p>content</p></page>")
  last()
}

function setCaretBefore(elt) {
  window.getSelection().empty()
  var r = document.createRange()
  r.setStartBefore(elt); r.collapse()
  window.getSelection().addRange(r)
}

function setCaretAfter(elt) {
  window.getSelection().empty()
  var r = document.createRange()
  r.setStartAfter(elt); r.collapse()
  window.getSelection().addRange(r)
}

function setCaretAtBeginingOf(elt){
  window.getSelection().empty()
  var r = document.createRange()
  r.selectNodeContents(elt);
  window.getSelection().addRange(r)
}


function on_input_latex(s, isEq) {
  if(s.rangeCount!==1) return;
  var i = s.anchorNode.wholeText.substr(0,s.anchorOffset-1).lastIndexOf('$$')
  if(i===-1 && !isEq) i = s.anchorNode.wholeText.substr(0,s.anchorOffset-1).lastIndexOf('$')
  if(i===-1) return;
  var after = s.anchorNode.splitText(s.anchorOffset)
  if(isEq && i!=0) i-=1
  convertTexNode2SVG_wrap(s.anchorNode.splitText(i), isEq, () => {  setCaretBefore(after)  })
}


ace_editors = []
function on_input_code(s) {
  if(s.rangeCount!==1) return;
  var after = s.anchorNode.splitText(s.anchorOffset-1)
  after.splitText(1)
  code = $("<pre></pre><p class='dummy'>&nbsp;</p>")
  $(after).replaceWith(code)
  ace.config.set('basePath', app.getAppPath() + "/src/lib/ace/")
  create_code_editor(code[0])
}



function on_newline(s) {
  if(s.rangeCount!==1) return false;

  if(['PRE', 'DIV'].indexOf(s.anchorNode.tagName) !== -1 && !$(s.anchorNode).hasClass("latex_editor")) {
    var p = $("<p>&nbsp;</p>")
    $(s.anchorNode).after(p);
    s.setPosition(p[0],0)
    return true;
  }

  if($(s.anchorNode).text().indexOf("1. ")===0) return create_ol_at(s.anchorNode)
  if($(s.anchorNode).text().indexOf("- ")===0) return create_ul_at(s.anchorNode)
  if($(s.anchorNode).text().indexOf("* ")===0) return create_ul_at(s.anchorNode)
  return false;
}

function create_ol_at(node) {
  e = $("<ol><li>"+$(node).text().substr(3)+"</li><li>&nbsp;</li></ol>")
  $(node).replaceWith(e)
  setCaretAtBeginingOf(e.children("li")[1])
  return true;
}

function create_ul_at(node) {
  e = $("<ul><li>"+$(node).text().substr(2)+"</li><li>&nbsp;</li></ul>")
  $(node).replaceWith(e)
  setCaretAtBeginingOf(e.children("li")[1])
  return true;
}


ipcRenderer.on("exportpdf-begin", () => {
  $("body").append("<div id='exportpdf-wait'>Exporting to PDF ... </div>")
})
ipcRenderer.on("exportpdf-end", () => {
  $("#exportpdf-wait").remove()
})
