
String.prototype.between = function(a,b) {
  var x = this.substr(this.lastIndexOf(a)+1)
  return x.substr(0, x.indexOf(b))
}
