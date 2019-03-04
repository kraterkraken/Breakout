"use strict";

// initialize GLOBAL config values
const CONFIG =
{
    debug_autopilot : false, // paddle never misses when true!
    startLives : 1,
    brickColor : "rainbow", // "rainbow" or a valid HTML color.  "rainbow" makes a rainbow of colors
    ballColor : "lightblue",
    paddleColor : "yellow",

    statusBarHeight : 100, // NOTE:  the top wall of the game "arena" is at y=statusBarHeight
                            // IMPORTANT: changing the statusBarHeight from 100 will have unexpected
                            // results, since the text in there is a fixed font size, and won't scale
    statusBarColor : "#555555",
    font : "Courier New",

    canvasHeight : 750,
    canvasWidth : "dynamic", // "dynamic" or an integer representing the width in pixels
                        // "dynamic" width is based on the size and spacing of the bricks
    brickRows : 8,
    brickColumns : 10,
    brickSpacing : 2,
    brickWidth : 75,
    brickHeight : 25,
    brickValues : [15, 13, 11, 9, 7, 5, 3, 1], // array of score values for each row of bricks, from top to bottom
    brickRowAccelerations : [50, 50, 0, 50, 0, 50, 0, 0], // tells how much each row will accelerate the ball when hit (px/sec) from top to bottom
    brickYOffset : 100, // this tells how much space is between the top wall and the bricks

    ballRadius : 5,
    initialBallSpeed : 300, // pixels per second
    initialBallDirection : -Math.PI / 4, // radians ... zero is due east, angle sweeps clockwise as it increases

    paddleWidth : 60,
    paddleHeight : 10,
    paddleY : 700,

    frameRate : 60 // frames per second
}

// --------------------------------------------------------------------
// this is just for testing so I can figure out what is going on with angles
function logAngle(radians)
{
    // normalize the angle
    let norm = Math.atan2(Math.sin(radians), Math.cos(radians))

    // convert to degrees before logging
    let degrees = 180 * norm/Math.PI;

    console.log("ball direction = " + degrees);
}

// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
class EZArt
{
    static drawBox(ctx, color, x, y, width, height)
    {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, width, height);
    }

    static drawCircle(ctx, color, x, y, radius)
    {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI*2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = color;
        ctx.stroke();
    }

    static drawText(ctx, text, font, color, x, y)
    {
        ctx.textBaseline = "top";
        ctx.font = font;
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
    }

}

// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
class BreakoutGame
{
    // ---------------------------------------------------------------------
    constructor(canvasId)
    {
        // I'm not fond of defining instance variables this way, but this is how you do it (FOR NOW!) :-(
        this.running = false;
        this.isOver = false;
        this.wasRowHit = new Array(CONFIG.brickRows);
        for (let i=0; i<this.wasRowHit.length; i++)
        {
            this.wasRowHit[i] = false;
        }

        this.canvas = document.getElementById(canvasId);

        if (CONFIG.brickValues.length != CONFIG.brickRows)
        {
            alert("ERROR: number of brick rows does not match number of brick values.");
        }

        if (CONFIG.brickRowAccelerations.length != CONFIG.brickRows)
        {
            alert("ERROR: number of brick rows does not match number of brick row accelerations.");
        }

        if (CONFIG.canvasWidth == "dynamic")
        {
            this.canvas.width = CONFIG.brickWidth * CONFIG.brickColumns;
            this.canvas.width += CONFIG.brickSpacing * (CONFIG.brickColumns + 1);
        }
        else if (typeof CONFIG.canvasWidth == "number")
        {
            this.canvas.width = CONFIG.canvasWidth;
        }

        this.canvas.height = CONFIG.canvasHeight;
        this.ctx = this.canvas.getContext("2d");

        // set up all the entities that the game needs to keep track of
        this.statusBar = new StatusBar(CONFIG.statusBarColor, 0, 0, this.canvas.width, 100, CONFIG.startLives);
        this.ball = new Ball(CONFIG.ballColor, this.canvas.width/2, CONFIG.paddleY-CONFIG.ballRadius-1, CONFIG.ballRadius);
        this.paddle = new Paddle(CONFIG.paddleColor, (this.canvas.width - CONFIG.paddleWidth)/2, CONFIG.paddleY, CONFIG.paddleWidth, CONFIG.paddleHeight);
        this.bricks = [];
        this.entities = [];

        this.entities.push(this.ball);
        this.entities.push(this.paddle);
        this.entities.push(this.statusBar);

        for (let i=0, hue=0, y=this.statusBar.height + CONFIG.brickYOffset; i<CONFIG.brickRows; i++)
        {

            let color = CONFIG.brickColor;
            if (color == "rainbow")
            {
                color = "hsl(" + hue + ", 100%, 50%)";
                console.log(color);
            }

            y += CONFIG.brickSpacing;
            for (let j=0, x=0; j<CONFIG.brickColumns; j++)
            {
                x += CONFIG.brickSpacing;
                let newBrick = new Brick(color, x, y, CONFIG.brickWidth, CONFIG.brickHeight, CONFIG.brickValues[i]);
                this.entities.push(newBrick);
                this.bricks.push(newBrick);
                x += CONFIG.brickWidth;
            }
            y += CONFIG.brickHeight;
            hue += 275 / CONFIG.brickRows;
        }

        // one easy line to draw everything
        this.draw();
    }

    reset()
    {
        this.running = false;
        this.isOver = false;
        this.statusBar.score = 0;
        this.statusBar.livesLeft = CONFIG.startLives;
        this.ball.speed = 0;
        this.ball.direction = CONFIG.initialBallDirection;
        this.paddle.width = CONFIG.paddleWidth;

        for (let i=0; i<this.bricks.length; i++)
        {
            this.bricks[i].exists = true;
        }

        document.addEventListener("click", mouseClickHandler);
        this.redraw();

    }

    // ---------------------------------------------------------------------
    handleWallCollisions()
    {
        // check for wall collisions
        if (this.ball.right >= this.canvas.width || this.ball.left <= 0)
        {
            //we hit the left or right wall: rebound
            this.ball.direction = Math.PI - this.ball.direction;

            // adjust the position of the ball if a part of the ball is currently clipped by the wall
            // (this prevents some really weird rebound bugs where the ball just glides along the surface for a while)
            this.ball.x = (this.ball.right > this.canvas.width)? this.canvas.width - this.ball.radius : this.ball.x;
            this.ball.x = (this.ball.left < 0)? this.ball.radius : this.ball.x;
        }
        else if (this.ball.top <= this.statusBar.height)
        {
            // we hit the ceiling: change paddle size and rebound
            this.ball.direction = -this.ball.direction;
            this.paddle.width = CONFIG.paddleWidth/2;

            // adjust the position of the ball if a part of the ball is currently clipped by the ceiling
            // (this prevents some really weird rebound bugs where the ball just glides along the surface for a while)
            this.ball.y = (this.ball.top < 0)? this.ball.radius : this.ball.y;
        }
        else if (this.ball.bottom >= this.canvas.height)
        {
            // we hit the bottom wall: lose a life!
            this.ball.direction = -this.ball.direction;
        }
    }

    // ---------------------------------------------------------------------
    msgBox2Line(msg1, msg2)
    {
        // wow this is ugly
        let x = this.canvas.width/2;
        let y = this.canvas.height/2 - 100;
        let margin = 20;
        let vertSpace = 5;

        let height1 = 60;
        this.ctx.font = height1 + "px " + CONFIG.font;
        let width1 = this.ctx.measureText(msg1).width;

        let height2 = 20;
        this.ctx.font = height2 + "px " + CONFIG.font;
        let width2 = this.ctx.measureText(msg2).width;

        let width = Math.max(width1, width2) + margin*2;
        let height = height1 + height2 + vertSpace + margin*2;

        this.ctx.shadowBlur = 20;
        this.ctx.shadowColor = "black";
        this.ctx.shadowOffsetX = 5;
        this.ctx.shadowOffsetY = 5;
        EZArt.drawBox(this.ctx, "red", x - (width/2), y - margin, width, height);
        this.ctx.shadowBlur = 0;
        this.ctx.shadowOffsetX = 0;
        this.ctx.shadowOffsetY = 0;

        this.ctx.textBaseline = "top";
        this.ctx.textAlign = "center";
        this.ctx.fillStyle = "white";

        this.ctx.font = height1 + "px " + CONFIG.font;
        this.ctx.fillText(msg1, x, y);

        this.ctx.font = height2 + "px " + CONFIG.font;
        this.ctx.fillText(msg2, x, y + height1 + vertSpace);

        this.ctx.textAlign = "left";

    }

    // ---------------------------------------------------------------------
    handleEntityCollisions()
    {
        if (this.ball.checkCollisionWith(this.paddle))
        {
            // slightly adjust the ball's angle (keeps the game interesting)
            {
                // what percentage are we from the center to the edge
                let mid = this.paddle.x + (this.paddle.width/2)
                let percent = (this.ball.x - mid) / (this.paddle.width/2);
                this.ball.adjustImpactAngle(percent);
            }
        }
        else
        {
            for(let i=0; i<this.bricks.length; i++)
            {
                if (this.ball.checkCollisionWith(this.bricks[i]))
                {
                    this.bricks[i].exists = false;
                    this.statusBar.score += this.bricks[i].value;
                    // handle ball accelerations
                    let row = Math.floor(i / CONFIG.brickColumns); // what row are we in?

                    if (!this.wasRowHit[row])
                    {
                        this.wasRowHit[row] = true;
                        this.ball.speed += CONFIG.brickRowAccelerations[row];
                    }

                    console.log("SCORE! +" + this.bricks[i].value + ". New score is " + this.statusBar.score);
                    return; // only allow collision with one brick
                }
            }
        }
    }

    // ---------------------------------------------------------------------
    draw()
    {
        for (let i=0; i<this.entities.length; i++)
        {
            this.entities[i].draw(this.ctx);
        }
    }

    // ---------------------------------------------------------------------
    redraw()
    {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.draw(this.ctx);
    }

    // ---------------------------------------------------------------------
    moveBall()
    {
        // make the ball move
        let s = (this.ball.speed/CONFIG.frameRate);
        let xIncrement = s * Math.cos(this.ball.direction);
        let yIncrement = s * Math.sin(this.ball.direction);
        this.ball.x += xIncrement;
        this.ball.y += yIncrement;

        if (CONFIG.debug_autopilot)
        {
            this.paddle.x = this.ball.x - (this.paddle.width/2);
        }

    }

    // ---------------------------------------------------------------------
    checkLives()
    {
        if (this.isOver)
        {
            return;  // no point doing all this if the game is already over
        }

        if (this.ball.y + this.ball.radius >= this.canvas.height)
        {
            // the paddle missed the ball, so we lose a life, reset the ball on the paddle
            this.statusBar.livesLeft--;
            this.ball.speed = 0;
            this.ball.x = this.paddle.x + (this.paddle.width/2);
            this.ball.y = this.paddle.y - this.ball.radius - 1;
            this.ball.diredction = CONFIG.initialBallDirection;
            this.running = false;
            console.log("you lost a life!");

            if (this.statusBar.livesLeft == 0)
            {
                // game over
                this.isOver = true;
                this.redraw();  // we redraw here to make sure the status bar is updated on screen
                this.msgBox2Line("GAME OVER", "Press a key to play again.");

                document.addEventListener("keypress", keyPressHandler);
                document.addEventListener("click", mouseClickHandler);
                console.log("game over, man!  game over!");
            }
            else
            {
                // get ready to relaunch by a mouseclick
                document.addEventListener("click", mouseClickHandler);
            }
        }

    }
}

// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
class GameEntity
{
    // ---------------------------------------------------------------------
    constructor(color, x, y, speed=0, direction=0)
    {
        this.color = color;
        this.speed = speed;
        this.direction = direction;
        this.x = x;
        this.y = y;
        this.exists = true;
    }

    get left() {return null;}
    get right() {return null;}
    get top() {return null;}
    get bottom() {return null;}

    // ---------------------------------------------------------------------
    draw(ctx) { /* subclasses should override */ }

    // ---------------------------------------------------------------------
    setPosition(x, y) // convenience method
    {
        this.x = x;
        this.y = y;
    }

    // ---------------------------------------------------------------------
    checkCollisionWith(aGameEntity)
    {
        return false;
    }

}

// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
class StatusBar extends GameEntity
{
    // ---------------------------------------------------------------------
    constructor(color, x, y, width, height, startLives)
    {
        super(color, x, y, 0, 0);
        this. height = height;
        this.width = width;
        this.score = 0;
        this.livesLeft = startLives;
    }

    // ---------------------------------------------------------------------
    draw(ctx)
    {
        EZArt.drawBox(ctx, this.color, this.x, this.y, this.width, this.height);

        EZArt.drawText(ctx, "Score", "20px "+CONFIG.font, "white", this.x+10, this.y+10);
        EZArt.drawText(ctx, this.score, "60px "+CONFIG.font, "white", this.x+10, this.y+30);

        EZArt.drawText(ctx, "Lives", "20px "+CONFIG.font, "white", this.width-75, this.y+10);
        EZArt.drawText(ctx, this.livesLeft, "60px "+CONFIG.font, "white", this.width-75, this.y+30);

    }
}
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
class Ball extends GameEntity
{
    // ---------------------------------------------------------------------
    constructor(color, x, y, radius, speed=0, direction=0)
    {
        super(color, x, y, speed, direction);
        this.radius = radius;
    }

    get left() {return this.x - this.radius;}
    get right() {return this.x + this.radius;}
    get top() {return this.y - this.radius;}
    get bottom() {return this.y + this.radius;}

    // ---------------------------------------------------------------------
    draw(ctx)
    {
        EZArt.drawCircle(ctx, this.color, this.x, this.y, this.radius);
    }

    // ---------------------------------------------------------------------
    adjustImpactAngle(percent)
    {
        let maxDegrees = 10;  // degrees
        let maxRadians = Math.PI * (maxDegrees / 180); // radians ... I did this because it is easier to think in degrees

        // general case
        logAngle(this.direction);
        this.direction += (percent*maxRadians);
        logAngle(this.direction);
        console.log("====");
    }
    // ---------------------------------------------------------------------
    checkCollisionWith(that)
    {

        // this can't collide with that if that doesn't exist
        if (!that.exists)
        {
            return false;
        }

        // two things have collided if there are no gaps between them, so look for gaps
        if (this.right < that.left || this.bottom < that.top || that.right < this.left || that.bottom < this.top)
        {
            // we found gaps
            return false;
        }
        else // we collided, so figure out where we collided and respond appropriately
        {

            // Observations:
            // As this approaches that from the left, i and j (below) are positive.
            // When they collide, i becomes negative.  j remains positive until this has completely
            // passed through to the other side, at which point both i and j will be negative.
            // Therefore, when overlapped i*j is negative. If i*j is positive, then they are not overlapped.
            // Also whichever is smaller -- abs(i) or abs(j) -- indicates which side is likely the collision point.
            // If abs(i) is smaller, then we collided from the left.  Otherwise, we collided from the right.
            // (assumes that is not significantly smaller than this)

            let i = this.right - that.left;
            let j = that.right - this.left;
            let m = this.bottom - that.top;
            let n = that.bottom - this.top;

            if (that.left <= this.x && this.x <= that.right) // if we hit the top or bottom
            {
                // rebound
                this.direction = -this.direction;

                // adjust ball position a tad
                if (Math.abs(m) < Math.abs(n))
                {
                    // we hit from the top
                    this.y = that.top - this.radius - 1;
                }
                else
                {
                    // we hit from the bottom
                    this.y = that.bottom + this.radius  + 1;
                }
            }
            else if (that.top <= this.y && this.y <= that.bottom) // else if we hit the left or right
            {
                // rebound
                this.direction = Math.PI - this.direction;

                //adjust ball position a tad
                if (Math.abs(i) < Math.abs(j))
                {
                    // we hit from the left
                    this.x = that.left - this.radius - 1;
                }
                else
                {
                    // we hit from the right
                    this.x = that.right + this.radius + 1;
                }
            }
            else
            {
                // This is the edge case where we are overlapped corner to corner, but the ball's center
                // is not yet inside the vertical or horizontal bounds of aGameEntity.
                // Treat as a non-collision.
                return false;
            }

            return true;

        }
    }

}

// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
class Brick extends GameEntity
{
    // ---------------------------------------------------------------------
    constructor(color, x, y, width, height, value=0, speed=0, direction=0)
    {
        super(color, x, y, speed, direction);
        this.width = width;
        this.height = height;
        this.value = value;
    }

    get left() {return this.x;}
    get right() {return this.x + this.width;}
    get top() {return this.y;}
    get bottom() {return this.y + this.height;}

    // ---------------------------------------------------------------------
    draw(ctx)
    {
        if (this.exists)
        {
            EZArt.drawBox(ctx, this.color, this.x, this.y, this.width, this.height);
        }
    }
}

// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
class Paddle extends Brick
{
}

// -------------------------------------------------------------------------
// -------------------------- EVENT HANDLERS -------------------------------
// -------------------------------------------------------------------------
function mouseMoveHandler(e)
{

    if (!CONFIG.debug_autopilot)
    {
        // the middle of the paddle follows the mouse pointer
        game.paddle.x = e.clientX - game.paddle.width/2;
        //for some reason, the above line puts the paddle about 10px too far right, so adjust
        game.paddle.x -= 10;

        // don't go past the walls
        if (game.paddle.left < 0)
        {
            game.paddle.x = 0;
        }
        if (game.paddle.right > game.canvas.width)
        {
            game.paddle.x = game.canvas.width - game.paddle.width;
        }

        // if the game hasn't begun, the ball should follow the paddle
        if (!game.running)
        {
            game.ball.x = e.clientX;
            //for some reason, the above line puts the ball about 10px too far right, so adjust
            game.ball.x -= 10;
        }
    }
}

// -------------------------------------------------------------------------
function mouseClickHandler(e)
{
    if (game.isOver)
    {
        game.msgBox2Line("GAME OVER", "I said 'PRESS A KEY' not 'CLICK THE MOUSE'.  Sheesh!");
        return;
    }
    // the game starts when we click the mouse button
    game.running = true;

    // launch the ball
    game.ball.speed = CONFIG.initialBallSpeed;
    game.ball.direction = CONFIG.initialBallDirection;

    // once we launch, we will never do it again, so remove the listener
    document.removeEventListener("click", mouseClickHandler);

}

// -------------------------------------------------------------------------
function keyPressHandler(e)
{
    game.reset();
    document.removeEventListener("keypress", keyPressHandler);
}

////////////////////////////////////////////////////////////////////////////////
///////////////////////////////HERE IS WHERE THE MAGIC HAPPENS//////////////////
////////////////////////////////////////////////////////////////////////////////
function playGame()
{
    // Check how many lives are left, and make sure the game isn't over.
    // If it isn't, see if the ball hit anything this frame, then make it move,
    // and draw this frame.
    game.checkLives();
    if (!game.isOver)
    {
        game.handleWallCollisions();
        game.handleEntityCollisions(); // ISSUE: is there a problem if the ball hits the wall and the paddle at the same time?
        game.moveBall();
        game.redraw();
    }
}

var game = new BreakoutGame("breakoutCanvas");
document.addEventListener("click", mouseClickHandler);
document.addEventListener("mousemove", mouseMoveHandler);
setInterval(playGame, 1000/CONFIG.frameRate);
