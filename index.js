const express = require('express')
const app = express()
require('dotenv').config()
const cors = require('cors')
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const jwt = require('jsonwebtoken')

const port = process.env.PORT || 8000

// middleware
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  optionSuccessStatus: 200,
}
app.use(cors(corsOptions))

app.use(express.json())
app.use(cookieParser())

// Verify Token Middleware
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token
  console.log(token)
  if (!token) {
    return res.status(401).send({ message: 'unauthorized access' })
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err)
      return res.status(401).send({ message: 'unauthorized access' })
    }
    req.user = decoded
    next()
  })
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.kztejda.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})

async function run() {
  try {
    const usersCollection = client.db('attendanceSys').collection('users')
    const courseCollection = client.db('attendanceSys').collection('courses')
    const studentCollection = client.db('attendanceSys').collection('students')
    const attendanceCollection = client.db('attendanceSys').collection('attendances')
    // auth related api
    app.post('/jwt', async (req, res) => {
      const user = req.body
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '365d',
      })
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        })
        .send({ success: true })
    })
    // Logout
    app.get('/logout', async (req, res) => {
      try {
        res
          .clearCookie('token', {
            maxAge: 0,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
          })
          .send({ success: true })
        console.log('Logout successful')
      } catch (err) {
        res.status(500).send(err)
      }
    })

    //Save a user in db
    app.put("/user", async(req,res)=>{
       const user = req.body;
       const query = {email:user?.email}
       //check if user exist
       const isExist = await usersCollection.findOne(query)
       if(isExist){
               if(user.status === "requested")
               {
                 const upadateStatus = await usersCollection.updateOne(query,{
                  $set:{ status: user?.status},
                })
                 return res.send(upadateStatus)
               }else{
                return res.send(isExist)
               }
       }

       const options = {upsert: true}
       const updateDoc = {
        $set:{
          ...user,
          timestamp: Date.now()
        },
       }
       const result = await usersCollection.updateOne(query,updateDoc,options)
       res.send(result)
    })

    // add courses
    app.post("/courses", async(req,res)=>{
        const course = req.body;

        const result = await courseCollection.insertOne(course)
        res.send(result)
    } )

    // add students
    app.post("/students", async(req,res)=>{
      const student = req.body;

      const result = await studentCollection.insertOne(student)
      res.send(result)
  } )

  //add attendance
  app.post("/attendance", async(req, res)=>{
    try {
      const attendanceRecords = req.body;
      if (!Array.isArray(attendanceRecords)) {
        return res.status(400).json({ error: 'Data should be an array of attendance records' });
      }
      const result = await attendanceCollection.insertMany(attendanceRecords);
      res.status(201).json(result.ops);
    } catch (err) {
      res.status(500).json({ error: 'Failed to add records' });
    }
  
  })

    // get a user data using logged in user email
     app.get("/user/:email", async(req,res)=>{
       const email = req.params.email;
       const result = await usersCollection.findOne({email})
       res.send(result)
     })
      //get all courses to  client side
      app.get("/courses", async(req,res)=>{
        const result = await courseCollection.find().toArray()
        res.send(result)
      })
      //get all students to  client side
      app.get("/students", async(req,res)=>{
        const result = await studentCollection.find().toArray()
        res.send(result)
      })

      //get all attendances to  client side
      app.get("/attendances", async(req,res)=>{
        const result = await attendanceCollection.find().toArray()
        res.send(result)
      })

    
    
    // Get all user data from db
    app.get("/users",verifyToken, async (req,res)=>{
       const result = await usersCollection.find().toArray()
       res.send(result)
    })

    // Update a user role 
     app.patch("/users/update/:email", async(req,res)=>{
      const email = req.params.email;
      const user = req.body
      const query = { email }
      const updateDoc = {
         $set:{
           ...user,
           timestamp: Date.now()
         }
      }

      const result = await usersCollection.updateOne(query,updateDoc)
      console.log(result)
      res.send(result)
         
     })

    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 })
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    )
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir)

app.get('/', (req, res) => {
  res.send('Hello from IST ams Server..')
})

app.listen(port, () => {
  console.log(`IST ams is running on port ${port}`)
})