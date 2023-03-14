﻿using LinqTools;
using WebWindowNetCore;

WebView
    .Create()
    .InitialBounds(600, 800)
    .Title("Commander")
    .ResourceIcon("icon")
    .SaveBounds()
    .Url($"http://localhost:3000{Platform.QueryString}")
#if DEBUG        
    //.DebugUrl("http://localhost:3000")
#endif            
    .ConfigureHttp(http => http
    //     .ResourceWebroot("webroot", "/web")
        .UseSse("commander/sse", Events.Source)
        .SideEffect(_ => Events.StartEvents())
#if DEBUG        
        .CorsOrigin("http://localhost:3000")
#endif        
//        .UseJsonPost<Object, Object>("commander/showdevtools", )
        .Build())
#if DEBUG            
    .DebuggingEnabled()
#endif       
    .Build()
    .Run("de.uriegel.Commander");


