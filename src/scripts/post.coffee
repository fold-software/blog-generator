u "a[href='#back']"
    .handle 'click', ->
        do history.back

color = u(".border").nodes[0].style["background-color"]

u document
    .on 'scroll touchmove', ->
        progress = window.scrollY /  window.scrollMaxY * 100
        u "#progress"
            .nodes[0]
            .style
            .background = "linear-gradient(to right, " + color + " " + progress + "%, white " + progress + "%)"