var Gameboy = require('serverboy');
var fs = require('fs');
var fsExtra = require('fs-extra')
var jimp = require('jimp');
var rom = fs.readFileSync("Pokemon Blue.gb");
var Twitter = require('twitter');

var client = new Twitter({
  consumer_key: '',
  consumer_secret: '',
  access_token_key: '',
  access_token_secret: ''
});

var global_timestamp = 0
var global_page = 1  
var results = {"": ["END"]}
var MVP = ""
var MVP_MOVE = []

var DEBUG = false

inst = new Gameboy();
inst.loadRom(rom);

if(fs.existsSync('backup.ram'))
{
  // load ram?
  loaded = JSON.parse(fs.readFileSync('backup.ram'));
  inst.loadState(loaded)
}

function postWithMessage(message, data)
{
  // Make post request on media endpoint. Pass file data as media parameter
  client.post('media/upload', {media: data}, function(error, media, response)
  {
    if(error)
    {
      console.log(error)
    }
    else 
    {
      // Lets tweet it
      var status = 
      {
        status: message,
        media_ids: media.media_id_string // Pass the media id string
      }
      client.post('statuses/update', status, function(error, tweet, response) {
      if (error) 
      {
        console.log(error);
      }
    });
  }

  var d = new Date();
  console.log(60 - d.getSeconds())
  setTimeout(fetchResponses, DEBUG ? 1 : 1000 * (60 - d.getSeconds()))
  });
}


function sendTweet()
{
  console.log("sending tweet. MVP:" + MVP)
  var data = fs.readFileSync('out.png');
  if(MVP == "")
  {
    var d = new Date();
    console.log(60 - d.getSeconds())
    setTimeout(fetchResponses, DEBUG ? 1 : 1000 * (60 - d.getSeconds()))
    
  } else if (MVP == "Anonymous")
  {
    postWithMessage(MVP_MOVE + " (Anonymous)",data)
  } 
  else
  {
    client.get('users/show', {user_id: MVP}, function(error, response)
    {
      if(error)
      {
        console.log(error)
        postWithMessage(MVP_MOVE + " (Anonymous)",data)
      } else
      {
         postWithMessage(MVP_MOVE + " (@" + response["screen_name"] + ")",data) 
      }
    })
  }
}

function interpMessage(m)
{
  list = []
  moves = ["A","B","LEFT","RIGHT","UP","DOWN","START","SELECT"]
  csv = m.split(',').join(' ').trim().replace(/\s\s+/g, ' ').split(" ");
  if(csv.length > 10)
  {
    return null
  }

  for(let i = 0; i != csv.length; ++i)
  {
    val = csv[i].trim().toUpperCase()
    if(moves.includes(val))
    {
      list.push(val)
    } 
    else
    {
      return null
    }
  }
  list.push("END")
  return list
}


function deduceMove(moveDict)
{
  descision_path = []
  if(Object.keys(moveDict).length > 1)
  {
   delete moveDict[""]
  }

  while(true)
  {
    descision_hash = {}
    pot_winner_hash = {}

    for(var key in moveDict)
    {
      // Add all candidates.
      input = moveDict[key][0]
      if(!descision_hash[input])
      {
        descision_hash[input] = 0
      }
      descision_hash[input] += 1
      pot_winner_hash[input] = key
    }
 
    // Pick winner.
    win = Object.keys(descision_hash).reduce((a, b) => descision_hash[a] > descision_hash[b] ? a : b);
    if(win == "END")
    {
      return [descision_path, pot_winner_hash[win]]
    }
    // cull
    for(var key in moveDict)
    {
      choice = moveDict[key].shift()
      if(choice != win)
      {
        delete moveDict[key]
      }
    }
    descision_path.push(win)
  }
}

function readFiles(dirname)
{
  data = []

  fs.readdirSync(dirname).forEach(filename => 
  {
    data.push(fs.readFileSync(dirname + filename, 'utf8'))
  });
  return data
}

function fetchResponses()
{
    data = readFiles("inputs/")
 
    data.forEach
    ((e) =>
    {   
      sv = e.split("\n")
      if(sv[1].toUpperCase().includes("ANON"))
      {
        sv[0] = "Anonymous"
        sv[1] = sv[1].toUpperCase().replace("ANON","")
      }

      if(sv[0] && sv[1])
      {
        parsed = interpMessage(sv[1])
        if(parsed)
        {
          results[sv[0]] = parsed
        }
      }
    }
    );

    fsExtra.emptyDirSync("inputs/")

    render(deduceMove(results))
    results = {"": ["END"]}
}


function render(dir)
{
    for(let i=0; i != 120 * 60; i += 1)
    {
      if((i % 700 < 10) && (dir[0].length > ((i/700) | 0)))
      {   
         var key = dir[0][(i/700) | 0]
         inst.pressKey(key)
      }

      inst.doFrame();
    }
    scr = inst.getScreen()
    var png = new jimp(256, 144, "#000000ff");
    for (let i=0; i<scr.length; i+=4) 
    {
        png.setPixelColor(
        jimp.rgbaToInt(scr[i], scr[i+1], scr[i+2], scr[i+3]),
        48 + ((i/4) % 160),
        ((i/4) / 160) | 0)
    }
    MVP_MOVE = dir[0].join(", ")
    MVP = dir[1]

    console.log("writing starts")
    fs.writeFileSync("backup.ram",JSON.stringify(inst.saveState()))
    console.log("writing ends")

    png.write("out.png",sendTweet)
}

render([[],""])
