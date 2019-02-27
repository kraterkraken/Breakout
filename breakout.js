"use strict";

// initialize GLOBAL config values
const CONFIG =
{
    startLives : 3,
    brickColor : "rainbow", // "rainbow" or a valid HTML color.  "rainbow" makes a rainbow of colors
    ballColor : "lightblue",
    paddleColor : "yellow",

    statusBarHeight : 100, // note:  the top wall of the game "arena" is at y=statusBarHeight
    statusBarColor : "#555555",

    canvasHeight : 750,
    canvasWidth : "dynamic", // "dynamic" or an integer representing the width in pixels
                        // "dynamic" width is based on the size and spacing of the bricks

    brickRows : 8,
    brickColumns : 10,
    brickSpacing : 2,
    brickWidth : 75,
    brickHeight : 25,
    brickValues : [15, 13, 11, 9, 7, 5, 3, 1], // array of values for each row of bricks, from top to bottom
    brickYOffset : 100, // this tells how much space is between the top wall and the bricks

    ballRadius : 5,
    initialBallSpeed : 300, // pixels per second
    initialBallDirection : -Math.PI / 4, // radians ... zero is due east, angle sweeps counter-clockwise as it increases

    paddleWidth : 60,
    paddleHeight : 10,
    paddleY : 700,

    frameRate : 60 // frames per second
}

// --------------------------------------------------------------------
// this is just for testing so I can figure out what is going on with angles
function normalizeAngle(radians)
{
    let newAngle = radians;
    while (newAngle <= -Math.PI) newAngle += 2*Math.PI;
    while (newAngle > Math.PI) newAngle -= 2*Math.PI;
    return newAngle;
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

        this.canvas = document.getElementById(canvasId);

        if (CONFIG.brickValues.length != CONFIG.brickRows)
        {
            alert("ERROR: number of brick rows does not match number of brick values.")
        }

        if (CONFIG.canvasWidth == "dynamic")
        {
            this.canvas.width = CONFIG.brickWidth * CONFIG.brickColumns;
            this.canvas.width += CONFIG.brickSpacing * (CONFIG.brickColumns + 1)
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
            // we hit the ceiling: rebound
            this.ball.direction = -this.ball.direction;

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
    handleEntityCollisions()
    {
        if (this.ball.checkCollisionWith(this.paddle))
        {
            // slightly adjust the ball's angle (keeps the game interesting)
            {
                // what percentage are we from the center to the edge
                let mid = this.paddle.x + (this.paddle.width/2)
                let percent = (this.ball.y - mid) / mid;
                //change direction a max of 0.2 radians (about 11 degrees)
                //this.ball.direction += percent * 0.2;
            }
        }

        for(let i=0; i<this.bricks.length; i++)
        {
            if (this.ball.checkCollisionWith(this.bricks[i]))
            {
                this.bricks[i].exists = false;
                this.statusBar.score += this.bricks[i].value;
                console.log("SCORE! +" + this.bricks[i].value + ". New score is " + this.statusBar.score);
                return; // only allow collision with one brick
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
    }

    // ---------------------------------------------------------------------
    checkLives()
    {
        if (this.ball.y + this.ball.radius >= this.canvas.height)
        {
            // the paddle missed the ball, so we lose a life
            // and we have to reset the ball on the paddle, ready to launch
            // by a mouseclick

            console.log("you lost a life!");

            this.statusBar.livesLeft--;
            this.ball.speed = 0;
            this.ball.x = this.paddle.x + (this.paddle.width/2);
            this.ball.y = this.paddle.y - this.ball.radius - 1;
            this.ball.diredction = CONFIG.initialBallDirection;
            this.running = false;

            document.addEventListener("click", mouseClickHandler);

            // TODO: add some sort of animation or on-screen msg that
            // we lose a life

            if (this.statusBar.livesLeft == 0)
            {
                console.log("game over, man!  game over!");
                // TODO: add some sort of animation or on-screen GAME OVER msg.
                // Also allow player to restart game.
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
        // TODO: figure out how to display text
        ctx.font = "20px Verdana";
        ctx.textBaseline = "top";
        ctx.fillStyle = "white";
        ctx.fillText("Score", this.x + 10, this.y + 10);
        ctx.fillText("Lives", this.width - 75, this.y + 10);
        ctx.font = "60px Verdana";
        ctx.fillText(this.score, this.x + 10, this.y + 30);
        ctx.fillText(this.livesLeft, this.width - 75, this.y + 30);

        // if (ctx.measureText)
        // {
        //     while(ctx.measureText("Tutorials Park").width > 240)
        //     {
        //         fontSize--;
        //         ctx.font = fontSize + "px Verdana";
        //     }
        //
        //     ctx.fillText("Text size is  " + fontSize + "px", 0, 0);
        // }
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
                    this.y = that.top - this.radius;
                }
                else
                {
                    // we hit from the bottom
                    this.y = that.bottom + this.radius;
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
                    this.x = that.left - this.radius;
                }
                else
                {
                    // we hit from the right
                    this.x = that.right + this.radius;
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

function mouseClickHandler(e)
{
    // the game starts when we click the mouse button
    game.running = true;

    // launch the ball
    game.ball.speed = CONFIG.initialBallSpeed;
    game.ball.direction = CONFIG.initialBallDirection;

    // once we launch, we will never do it again, so remove the listener
    document.removeEventListener("click", mouseClickHandler);

}

////////////////////////////////////////////////////////////////////////////////
///////////////////////////////HERE IS WHERE THE MAGIC HAPPENS//////////////////
////////////////////////////////////////////////////////////////////////////////
function playGame()
{
    // Check if the ball hit anything this frame, then make it move.
    // After that, see if any lives were lost.  Finally, draw this frame.
    game.handleWallCollisions();
    game.handleEntityCollisions(); // ISSUE: is there a problem if the ball hits the wall and the paddle at the same time?
    game.moveBall();
    game.checkLives();
    game.redraw();
}

var game = new BreakoutGame("breakoutCanvas");
document.addEventListener("click", mouseClickHandler);
document.addEventListener("mousemove", mouseMoveHandler);
setInterval(playGame, 1000/CONFIG.frameRate);
