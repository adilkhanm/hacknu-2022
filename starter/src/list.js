let data = [{ city: "Hokkaido", info: "Very snowy" }, { city: "Astana", info: "QUite snowy too" }, { city: "Tampere", info: "I suppose it is snowy too" }]

let list = document.getElementById("History");
console.log(list);
if (list) {
    data.forEach((item) => {
        let hr = document.createElement("hr");
        let title = document.createElement("h3");
        let p = document.createElement("p");
        title.innerText = item.city;
        p.innerText = item.info;
        list.appendChild(hr)
        list.appendChild(title)
        list.appendChild(p)

    })
}

function openPath(id) {
    httpGetAsync(`localhost:8082/map/` + id)
}

function httpGet(theUrl) {
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.open("GET", theUrl, false); // false for synchronous request
    xmlHttp.send(null);
    return xmlHttp.responseText;
}

function httpGetAsync(theUrl, callback)
{
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function() { 
        if (xmlHttp.readyState == 4 && xmlHttp.status == 200)
            callback(xmlHttp.responseText);
    }
    xmlHttp.open("GET", theUrl, true); // true for asynchronous 
    xmlHttp.send(null);
}
