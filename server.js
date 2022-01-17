const express = require("express");
const bcrypt = require("bcrypt");
var mysql = require("mysql");
var cors = require("cors");
const dotenv = require("dotenv");
var jwt = require("jsonwebtoken");

const port = 4000;

var dbase = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: null,
  database: "radnet",
});
const app = express();
dbase.connect();
dotenv.config();
app.use(
  cors({
    origin: "http://161.230.225.30:3000",
    credentials: true,
    methods: ["GET", "POST"],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.post("/login", (req, res) => {
  let email = req.body.email;
  let password = req.body.password;
  dbase.query(
    "SELECT * FROM utilizadores WHERE Email=?",
    [email],
    (err, resultDB1) => {
      if (err) throw error;
      if (resultDB1.length > 0) {
        bcrypt.compare(password, resultDB1[0].Password, (err, resultComp) => {
          if (err) throw err;
          if (resultComp) {
            const ID = resultDB1[0].IDU;
            const token = jwt.sign({ ID }, process.env.SECRET_KEY_JWT, {
              expiresIn: "1 day",
            });
            res.send({
              ack: 1,
              user: resultDB1[0].Email,
              token: token,
            });
          } else {
            res.send({
              ack: 0,
              message: "Wrong Credentials",
            });
          }
        });
      } else {
        res.send({
          ack: 0,
          message: "Wrong Credentials",
        });
      }
    }
  );
});
app.post("/register", (req, res) => {
  let email = req.body.email;
  let password = req.body.password;
  dbase.query(
    "SELECT Email FROM utilizadores WHERE Email=?",
    [email],
    (err, resdb1) => {
      if (err) throw err;
      if (resdb1.length === 0) {
        bcrypt.hash(password, 10, (err, hash) => {
          if (err) throw err;
          dbase.query(
            "INSERT INTO utilizadores (Email,Password) Values (?,?)",
            [email, hash],
            (err, resultDB) => {
              if (err) throw err;
              res.send({ ack: 1 });
            }
          );
        });
      } else {
        res.send({ ack: 0, message: "Conta já existe com esse email!" });
      }
    }
  );
});
const verifyJWT = (req, res, next) => {
  var token = req.headers.authorization.split(" ")[1];
  if (!token) {
    res.status(401).json({ message: "Nenhum token recebido!" });
  } else {
    jwt.verify(token, process.env.SECRET_KEY_JWT, (err, decoded) => {
      if (err) {
        console.log(err);
        res.status(401).json({ auth: false, message: "Não autorizado!" });
      } else {
        req.userId = decoded.id;
        next();
      }
    });
  }
};

//ROUTES PROTEGIDAS
app.get("/getCities/:data", verifyJWT, (req, res) => {
  let data = req.params.data;
  dbase.query("SELECT * from localizacoes", (err, resDB) => {
    if (err) throw err;
    console.log(data);
    res.send(resDB);
  });
});
app.post("/addCity", verifyJWT, (req, res) => {
  let Nome = req.body.Nome;
  let X = req.body.X;
  let Y = req.body.Y;
  dbase.query(
    "Insert Into localizacoes (Nome,X,Y) VALUES(?,?,?) ",
    [Nome, X, Y],
    (err, resDB) => {
      if (err) throw err;
      res.status(200).json({ ack: 1 });
    }
  );
});
app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
