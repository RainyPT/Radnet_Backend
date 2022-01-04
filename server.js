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
    origin: "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST"],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.post("/login", (req, res) => {
  let email = req.body.email;
  let password = req.body.password;
  let doesUserExist = "SELECT * FROM utilizadores WHERE Email='" + email + "';";
  dbase.query(doesUserExist, (err, resultDB1) => {
    if (err) throw error;
    if (resultDB1.length > 0) {
      bcrypt.compare(password, resultDB1[0].Password, (err, resultComp) => {
        if (err) throw err;
        if (resultComp) {
          const ID = resultDB1[0].IDU;
          const token = jwt.sign({ ID }, process.env.SECRET_KEY_JWT, {
            expiresIn: 86400,
          });
          res.send({
            ack: 1,
            user: resultDB1[0].Email,
            token: token,
          });
        } else {
          res.send({
            ack: 0,
            message: "Password errada!",
          });
        }
      });
    } else {
      res.send({
        message: "Utilizador não existe",
        ack: 0,
      });
    }
  });
});
app.post("/register", (req, res) => {
  let email = req.body.email;
  let password = req.body.password;
  dbase.query(
    "SELECT Email FROM utilizadores WHERE Email='" + email + "'",
    (err, resdb1) => {
      if (err) throw err;
      if (resdb1.length === 0) {
        if (err) throw err;
        bcrypt.hash(password, 10, function (err, hash) {
          if (err) throw err;
          let insertUserSQLString =
            "INSERT INTO utilizadores (Email,Password) Values ('" +
            email +
            "','" +
            hash +
            "')";
          dbase.query(insertUserSQLString, (err, resultDB) => {
            if (err) throw err;
            res.send({ ack: 1 });
          });
        });
      } else {
        res.send({ ack: 0, message: "Conta já existe com esse email!" });
      }
    }
  );
});
const verifyJWT = (req, res, next) => {
  const token = req.headers["x-access-token"];
  if (!token) {
    res.status(401).json({ message: "Nenhum token recebido!" });
  } else {
    jwt.verify(token, process.env.SECRET_KEY_JWT, (err, decoded) => {
      if (err) {
        res.status(401).json({ auth: false, message: "Não autorizado!" });
      } else {
        req.userId = decoded.id;
        next();
      }
    });
  }
};

//ROUTES PROTEGIDAS
app.get("/getCities", verifyJWT, (req, res) => {
  dbase.query("SELECT * from cidades", (err, resDB) => {
    if (err) throw err;
    res.send(resDB);
  });
});
app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
