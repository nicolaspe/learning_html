/* Bee's genes (genotype and phenotype)
  Speed     -> The faster, the bigger the wings
  Capacity  -> The more capacity, the bigger the bee 
               (but also slower)
  Toughness -> Max force it can resist
  Vision    -> Field of view of the bee
  Separation-> Desired flock separation
  Influence -> Distance of influence of the flock
  Steering  -> Each steering force has a factor coded in genes!
  Life      -> Maximum lifespan
*/

function Bee(x, y, v, sourceDna){
  this.dna = sourceDna;
  this.pos = createVector(x, y);
  this.vel = p5.Vector.fromAngle(v);
  this.acc = createVector(0, 0);

  colorMode(HSB, 360, 100, 100, 100);
  this.h = color(54, 99, 99);

  // Genetic data assignment
  this.maxspeed = this.dna.genes[0]; // Bee max speed
  this.cap = this.dna.genes[1];      // Max amount of polen that can be stored
  this.r = map(this.cap, 20, 80, 3, 6); // Bee size
  this.wr = this.r*map(this.maxspeed, 1, 10, 1, 3); // Bee wing length
  this.maxspeed -= map(this.cap, 20, 80, -2, 2);  // Speed correction
  this.maxforce = this.dna.genes[2];         // Bee max steering force
  this.vision = this.r*this.dna.genes[3];    // viewing distance to detect nearby flowers
  this.flock_sep = this.r*this.dna.genes[4]; // flock desired SEParation
  this.flock_inf = this.r*this.dna.genes[5]; // distance of INFluence of the flock
  this.sepFactor = this.dna.genes[6];   // force factor for separation
  this.cohFactor = this.dna.genes[7];   // force factor for cohesion
  this.aliFactor = this.dna.genes[8];   // force factor for alignment
  this.foodFactor = this.dna.genes[9];  // force factor for FEED to go to flowers
  this.hiveFactor = this.dna.genes[10]; // force factor for FEED to return to hive
  this.life = this.dna.genes[11]; // Maximum lifespan

  // Initial status
  this.timer = 0;     // Timer to track how much it takes to return with food
  this.recordTime = this.life;  // Track the fastest time it has taken to deliver food
  this.rounds = 0;    // Track how many times it has come and gone (max 4)
  this.polen = 0;     // Amount of polen stored
  this.search = true; // Searchs for food until full, then returns to hive
  this.fitness = 0;   // Fitness value

  // Calculates the fitness of the current bee.
  // term1 sees how much does it take to deliver the polen
  //    it grows exponentially the more times it delivers
  // term2 grants points for lifespan (5-15)
  this.calcFitness = function(){
    var term1 = constrain(this.cap*100/this.recordTime, 1, 100);
    term1 = map(this.cap*100/this.recordTime, 1, 100, 1, 10);
    var term2 = this.dna.genes[11]/100;
    this.fitness = pow(term1,this.rounds+1) +term2;
    this.dna.fitness = this.fitness;
    return this.fitness;
  }


  this.applySteering = function(bees, flowers, hive) {
    // Flock conduct with other bees: separation, cohesion, alignment
    var sf = this.separate(bees, this.flock_sep);
    var cf = this.cohesion(bees, this.flock_inf);
    var af = this.align(bees, this.flock_inf);
    var ff = this.feed(flowers, hive);

    // Multiplication factors
    sf.mult(this.sepFactor);
    cf.mult(this.cohFactor);
    af.mult(this.aliFactor);
    if (this.search) {
      ff.mult(this.foodFactor);
    } else {
      ff.mult(this.hiveFactor);
    }

    // Force application
    this.applyForce(sf);
    this.applyForce(cf);
    this.applyForce(af);
    this.applyForce(ff);
  }

  // Steers away from other nearby objects
  /*  array =  array of possible objects to be separated of
  tolerance =  maximum separation influence distance
  */
  this.separate = function(array, tolerance) {
    var count = 0;
    var desired = createVector(0, 0);
    // Check for every object in the array
    for (var i = 0; i < array.length; i++) {
      var d = p5.Vector.dist(this.pos, array[i].pos);
      // If distance is between ]0, tolerance]
      if ((d > 0) && (d < tolerance)) {
        var d_vel = p5.Vector.sub(this.pos, array[i].pos);
        // desired velocity inversely proportional to distance
        d_vel.setMag(map(d, 0, tolerance, this.maxspeed, 0));
        desired.add(d_vel);
        count++; // keeping track
      }
    }
    // Average
    if (count > 0) desired.div(count);
    // If non null forces are being applied, implement Reynolds
    var steering = createVector(0, 0);
    if (desired.mag() > 0) {
      desired.setMag(this.maxspeed);
      steering = p5.Vector.sub(desired, this.vel);
      steering.limit(this.maxforce);
    }
    return steering;
  }
  
  // Keeps the nearby flock together
  /*  array =  array of possible objects to be separated of
  influence =  maximum flock influence distance
  */
  this.cohesion = function(array, influence) {
    var count = 0;
    var target = createVector(0, 0); // vector will save the average flock location
    // Check for every object in the array
    for (var i = 0; i < array.length; i++) {
      var d = p5.Vector.dist(this.pos, array[i].pos);
      // If distance is between ]0, influence]
      if ((d > 0) && (d < influence)) {
        target.add(array[i].pos);
        count++; // keeping track
      }
    }
    // Average
    if (count > 0) {
      target.div(count);
      return this.seek(target);
    } else {
      return createVector(0, 0);
    }
  }
  
  // Aligns the direction of the flock 
  /*  array =  array of possible objects to be separated of
  influence =  maximum flock influence distance
  */
  this.align = function(array, influence) {
    var count = 0;
    var flockV = createVector(0, 0); // vector will save the average flock velocity
    // Check for every object in the array
    for (var i = 0; i < array.length; i++) {
      var d = p5.Vector.dist(this.pos, array[i].pos);
      // If distance is between ]0, influence]
      if ((d > 0) && (d < influence)) {
        flockV.add(array[i].pos);
        count++; // keeping track
      }
    }
    // Average
    if (count > 0) {
      flockV.div(count);
      flockV.setMag(this.maxspeed);
      // Implement Reynolds
      var steering = p5.Vector.sub(flockV, this.vel);
      steering.limit(this.maxforce);
      return steering;
    } else {
      return createVector(0, 0);
    }
  }
  
  // Locates the nearest flower to go feed on it or biggest empty hive cell to store polen
  this.feed = function(flowers, hive) {
    var count = 0;
    var target = createVector(0, 0); // vector will save the target locations
    // Decide if hunting flowers or searching home location
    if (this.search) {  // hunting flowers
      // Check for every object in the array
      for (var i = 0; i < flowers.length; i++) {
        var d = p5.Vector.dist(this.pos, flowers[i].pos);
        // If distance is between ]0, influence]
        if ((d > 0) && (d < this.vision)) {
          target.add(flowers[i].pos);
          count++; // keeping track
        }
      }
    } else {  // go to store the polen
      var ind = 0;        // index storage
      var val = 10000.0;  // value storage
      // it has to go to the nearst and biggest empty cell, so first it searches
      // for that cell, and after it's chosen, it heads that way
      for (var i = 0; i < hive.length; i++) {
        if (!hive[i].full) {
          var d = p5.Vector.dist(this.pos, hive[i].pos);  // distance
          if ((d > 0) && (d < this.vision*3+hive[i].r)) {
            var v = d/hive[i].cap;  // new value = dist/capacity
            if(v < val){  // if this is a better choice
              val = v;
              ind = i;
            }
          }
        }
      }
      target.add(hive[ind].pos);
      count++;
    }
    // Average
    if (count > 0) {
      target.div(count);
      return this.arrive(target);
    } else {
      return createVector(0, 0);
    }
  }
  
  // Steers towards a target
  this.seek = function(target) {
    var desired = p5.Vector.sub(target, this.pos);
    desired.setMag(this.maxspeed);

    var steering = p5.Vector.sub(desired, this.vel);
    steering.limit(this.maxforce);
    return steering;
  }
  
  // Steers towards a target, but stops when arrives (at a min distance)
  this.arrive = function(target) {
    var desired = p5.Vector.sub(target, this.pos);

    // Arrive behaviour
    var d = desired.mag();
    if (d < 100) {
      // map according to distance
      var m = map(d, 10, 100, 0, this.maxspeed);
      desired.setMag(m);
    } else {
      desired.setMag(this.maxspeed);
    }
  
    var steering = p5.Vector.sub(desired, this.vel);
    steering.limit(this.maxforce);
    return steering;
  }

  this.applyForce = function(force) {
    this.acc.add(force);
  }
  
  this.update = function() {
    this.vel.add(this.acc);
    this.vel.limit(this.maxspeed);
    this.pos.add(this.vel);
    this.borders();
    this.acc.set(0);
    
    this.timer++;
    this.life--;
  }

  // Checks whether the bee is full of polen and must go to hive
  this.loaded = function(){
    if(this.polen >= this.cap){
      this.search = false;
      this.h = color(0, 99, 99);
      return true;
    }
    return false;
  }
  // Checks whether the bee deposited all their polen
  this.unloaded = function(){
    if(this.polen <= 0 && !this.search){
      this.rounds = constrain(this.rounds+1, 0, 3); // Add 1 round
      this.recordTime = min(this.recordTime, this.timer);  // Checks for record time
      this.timer = 0; // Timer reset
      this.life += 100; // Bonus life for delivery
      this.search = true; // Starts searching again
      this.h = color(54, 99, 99); // Reset color
      return true;
    }
    return false;
  }
  
  // Border wrapping
  this.borders = function() {
    if (this.pos.x < -this.r) this.pos.x = width + this.r;
    if (this.pos.y < -this.r) this.pos.y = height + this.r;
    if (this.pos.x > width + this.r) this.pos.x = -this.r;
    if (this.pos.y > height + this.r) this.pos.y = -this.r;
  }
  
  this.display = function() {
    colorMode(HSB, 360, 100, 100, 100);
    var theta = this.vel.heading() - PI / 2;
    push();
    translate(this.pos.x, this.pos.y);
    rotate(theta);
    
    // Bee's head
    noStroke();
    fill(20)
    ellipse(0, this.r / 2, this.r * 3 / 2, this.r * 3 / 2);

    // Bee's body
    strokeWeight(1);
    stroke(20);
    fill(this.h);
    ellipse(0, -this.r / 2, this.r * 2, this.r * 2);

    // Bee's lines
    push();
    translate(0, -this.r / 2);
    line(this.r, 0, -this.r, 0); // line #1
    line(this.r * .71, this.r / 2, -this.r * .71, this.r / 2); // line #2
    line(this.r * .71, -this.r / 2, -this.r * .71, -this.r / 2); // line #3
    pop();

    // Bee's wings
    push(); // wing #1
    translate(-this.r / 2, this.r / 2);
    rotate(radians(-45));
    translate(0, -this.r);
    stroke(40, 50);
    fill(250, 50);
    ellipse(0, 0, this.r, this.wr);
    pop();
    push(); // wing #2
    translate(this.r / 2, this.r / 2);
    rotate(radians(45));
    translate(0, -this.r);
    stroke(40, 50);
    fill(250, 50);
    ellipse(0, 0, this.r, this.wr);
    pop();
    pop();
  }

  
}