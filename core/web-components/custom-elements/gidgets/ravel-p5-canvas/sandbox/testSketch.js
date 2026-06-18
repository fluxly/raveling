p.setup = () => {
  p.createCanvas(p.RAVEL_W, p.RAVEL_H);
  p.noStroke();
  console.log('Setup!');
};

p.draw = () => {
  p.background(240);
  p.fill(0);
  p.circle(100, 100, 30);
  p.circle(p.mouseX, p.mouseY, 30);
};